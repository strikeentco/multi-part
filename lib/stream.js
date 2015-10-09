'use strict';

var objectAssign = require('object-assign');
var CombinedStream = require('./combine');
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

  if (isStream(buf) || isBuffer(buf) || isVinyl(buf) || isHTTPStream(buf)) {
    if (isVinyl(buf)) {
      opts || (opts = {}); //object assign
      opts.filename || (opts.filename = buf.basename); //object assign
      buf = buf.contents;
    }

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

function Multipart(opts) {
  opts || (opts = {});
  this.boundary = opts.boundary || Boundary(opts.boundaryPrefix).get();
  this.headers = {
    'transfer-encoding': 'chunked',
    'content-type': 'multipart/form-data; boundary="' + this.boundary + '"'
  };
  this.body = [];
  this._storage = [];
}

Multipart.prototype._append = function(data) {
  Array.prototype.push.call(this.body, toStream(data));
};

Multipart.prototype._proccess = function(n) {
  if (!n) {
    if (this.body.length) {
      this._append('--' + this.boundary + '--');
      return;
    }

    return;
  }

  genBody.call(this, n, n.stream);
};

Multipart.prototype.getBoundary = function() {
  return this.boundary;
};

Multipart.prototype.getHeaders = function() {
  return this.headers;
};

Multipart.prototype.get = Multipart.prototype.getMultipart = function() {
  if (!(this.body instanceof CombinedStream)) {
    this._proccess(this._storage.shift());
    this.body = CombinedStream(this.body);
  }

  return this.body;
};

Multipart.prototype.getWithOptions = Multipart.prototype.getMultipartWithOptions = function(opts) {
  var multipart = objectAssign(
    {headers: this.getHeaders()},
    (isObject(opts)) ? opts : {}
  );

  multipart.body = this.getMultipart();

  return multipart;
};

Multipart.prototype.append = function(name, stream, opts) {
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

module.exports = Multipart;
