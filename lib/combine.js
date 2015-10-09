'use strict';

var util = require('util');
var ReadableStream = require('stream').Readable;
var ClientRequest = require('http').ClientRequest;

var helpers = require('./helpers');
var toStream = helpers.toStream;
var isPromise = helpers.isPromise;
var isBuffer = helpers.isBuffer;
var isString = helpers.isString;

function CombinedStream(streams) {
  if (!(this instanceof CombinedStream)) {
    return new CombinedStream(streams);
  }

  ReadableStream.call(this);

  this.destroyed = false;
  this._drained = false;
  this._forwarding = false;
  this._current = null;
  this._queue = streams.map(toStream);

  this._next();
};

util.inherits(CombinedStream, ReadableStream);

CombinedStream.prototype._read = function() {
  this._drained = true;
  this._forward();
};

CombinedStream.prototype._forward = function() {
  if (this._forwarding || !this._drained || !this._current) {
    return;
  }

  this._forwarding = true;

  var chunk;
  while ((chunk = this._current.read()) !== null) {
    this._drained = this.push(chunk);
  }

  this._forwarding = false;
};

CombinedStream.prototype._next = function() {
  var _this = this;
  this._current = null;

  var stream = this._queue.shift();
  if (isPromise(stream)) {
    return stream.then(function(res) {
      _this._gotNextStream(toStream(res));
    }).catch(function(e) {
      _this.destroy(e);
    });
  } else if (isString(stream) || isBuffer(stream)) {
    this._drained = this.push(stream);
    this._next();
    return;
  }

  this._gotNextStream(stream);
};

CombinedStream.prototype._gotNextStream = function(stream) {
  var _this = this;

  if (!stream) {
    _this.push(null);
    _this.destroy();
    return;
  }

  _this._current = stream;
  _this._forward();

  stream.on('readable', onReadable);
  stream.on('error', onError);
  stream.on('close', onClose);
  stream.on('end', onEnd);

  function onReadable() {
    _this._forward();
  }

  function onError(e) {
    _this.destroy(e);
  }

  function onClose() {
    stream._readableState.ended || _this.destroy();
  }

  function onEnd() {
    _this._current = null;
    stream.removeListener('readable', onReadable);
    stream.removeListener('end', onEnd);
    stream.removeListener('error', onError);
    stream.removeListener('close', onClose);
    _this._next();
  }
};

CombinedStream.prototype.destroy = function(e) {
  if (this.destroyed) {
    return;
  }

  this.destroyed = true;

  if (this._current && this._current.destroy) {
    this._current.destroy();
  }

  this._queue.forEach(function(stream) {
    !stream.destroy || stream.destroy();
  });

  if (e) {
    this.emit('error', e);
  }

  this.emit('close');
};

module.exports = CombinedStream;
