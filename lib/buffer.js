'use strict';

var util = require('util');
var EventEmitter = require('events');
var objectAssign = require('object-assign');

var Boundary = require('./boundary');

/* helpers */
var helpers = require('./helpers');

var isString = helpers.isString;
var isNumber = helpers.isNumber;
var isObject = helpers.isObject;
var isStream = helpers.isStream;
var isHTTPStream = helpers.isHTTPStream;
var isBuffer = helpers.isBuffer;
var isArray = helpers.isArray;
var isVinyl = helpers.isVinyl;

var toStream = helpers.toStream;
var getFileName = helpers.getFileName;
var getContentType = helpers.getContentType;

var CRLF = '\r\n';

function genBody(n, buf) {
  var contentType;
  var opts = n.options;

  this._append('--' + this.boundary + CRLF);
  this._append('Content-Disposition: form-data; name="' + n.name + '"');

  if (isStream(buf) || isBuffer(buf)) {
    var filename = (opts && opts.filename) ? getFileName(opts) : getFileName(buf);
    this._append('; filename="' + filename + '"' + CRLF);
    if (opts && (opts.filename || opts.fileName || opts.contentType)) {
      contentType = getContentType(opts);
    } else {
      contentType = getContentType({filename: filename});
    }

    this._append('Content-Type: ' + contentType + CRLF);
  } else {
    this._append(CRLF);
  }

  this._append(CRLF);
  this._append(buf);
  this._append(CRLF);

  this._proccess(this._storage.shift());
}

function streamBusiness(n, stream) {
  var _this = this;
  stream.on('data', function(data) {
    try {
      _this._current.push(data);
    } catch (e) {
      _this.emit('error', e);
    }
  });

  stream.on('error', function(err) {
    _this.emit('error', err);
  });

  stream.on('end', function() {
    try {
      genBody.call(_this, n, Buffer.concat(_this._current));
    } catch (e) {
      _this.emit('error', e);
    }

    _this._current = [];
  });
}

function MultipartBuffers(opts) {
  opts || (opts = {});
  this.chunked = !(opts.chunked === false);
  this.boundary = opts.boundary || Boundary(opts.boundaryPrefix).get();
  this.headers = {
    'content-type': 'multipart/form-data; boundary="' + this.boundary + '"'
  };
  this.body = [];
  this._storage = [];
}

util.inherits(MultipartBuffers, EventEmitter);

MultipartBuffers.prototype._append = function(data) {
  if (data == null || isObject(data)) {
    throw new TypeError('Value should be Buffer, Stream, Array, String or Number');
  } else {
    Array.prototype.push.call(this.body, new Buffer(data));
  }
};

MultipartBuffers.prototype._proccess = function(n) {
  var _this = this;
  if (!n) {
    if (!this.body.length) {
      this.body = new Buffer([]);
      this.emit('end');
      return;
    } else {
      this._append('--' + this.boundary + '--');
      this.body = Buffer.concat(this.body);
      this.getHeaders();
      this.emit('end');
      return;
    }
  }

  if (isVinyl(n.stream)) {
    n.options || (n.options = {});
    n.options.filename || (n.options.filename = n.stream.basename);
    n.stream = n.stream.contents;
  }

  if (isHTTPStream(n.stream)) {
    this._current || (this._current = []);
    n.stream
      .on('response', function(res) {
        streamBusiness.call(_this, n, res);
      })
      .on('error', function(err) {
        _this.emit('error', err);
      })
      .end();
  } else if (isStream(n.stream)) {
    this._current || (this._current = []);
    streamBusiness.call(_this, n, n.stream);
  } else {
    try {
      genBody.call(_this, n, n.stream);
    } catch (e) {
      this.emit('error', e);
    }
  }
};

MultipartBuffers.prototype.getBoundary = function() {
  return this.boundary;
};

MultipartBuffers.prototype.getHeaders = function() {
  if (this.chunked) {
    this.headers['transfer-encoding'] = 'chunked';
  } else {
    this.headers['content-length'] = this.body.length;
  }

  return this.headers;
};

MultipartBuffers.prototype.append = function(name, stream, opts) {
  if (!name || (!isNumber(name) && !isString(name))) {
    throw new Error('Name must be specified and must be a string or a number');
  }

  if (isArray(stream)) {
    if (!stream.length) {
      stream = '';
    } else {
      for (var i = 0; i < stream.length; i++) {
        this.append(name, stream[i], opts);
      }

      return this;
    }
  }

  if (stream === true || stream === false || stream === null) {
    stream = +stream;
  }

  if (isNumber(stream)) {
    stream += '';
  }

  if (isObject(opts)) {
    this._storage.push({name: name, stream: stream, options: opts});
  } else {
    this._storage.push({name: name, stream: stream});
  }

  return this;
};

MultipartBuffers.prototype._gen = function(opts, cb) {
  var _this = this;
  if (typeof opts === 'function') {
    this.on('error', opts);

    this.on('end', function() {
      opts(null, _this.body);
    });
  } else {
    this.on('error', cb);

    this.on('end', function() {
      var multipart = objectAssign(
        {headers: _this.getHeaders()},
        (isObject(opts)) ? opts : {}
      );

      multipart.body = _this.body;
      cb(null, multipart);
    });
  }

  this._proccess(this._storage.shift());
};

MultipartBuffers.prototype._getMultipart = function(opts, cb) {
  var _this = this;

  if (typeof cb === 'function') {
    _this._gen(opts, cb);
  } else {
    return new Promise(function(resolve, reject) {
      _this._gen(opts, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
};

MultipartBuffers.prototype.get = MultipartBuffers.prototype.getMultipart = function(cb) {
  return this._getMultipart(cb, cb);
};

MultipartBuffers.prototype.getWithOptions = MultipartBuffers.prototype.getMultipartWithOptions = function(opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  return this._getMultipart(opts, cb);
};

module.exports = MultipartBuffers;
