'use strict';

var ReadableStream = require('stream').Readable;
var ClientRequest = require('http').ClientRequest;

var path = require('path');
var mime = require('mime-kind');

var isNumber = module.exports.isNumber = function(val) {
  return typeof val === 'number';
};

var isString = module.exports.isString = function(val) {
  return typeof val === 'string';
};

var isObject = module.exports.isObject = function(val) {
  return Object.prototype.toString.call(val) === '[object Object]';
};

var isHTTPStream = module.exports.isHTTPStream = function(stream) {
  return stream && stream instanceof ClientRequest;
};

var isStream = module.exports.isStream = function(stream) {
  return stream && typeof stream === 'object' && typeof stream.pipe === 'function' && stream.readable !== false && typeof stream._read === 'function' && typeof stream._readableState === 'object';
};

var isBuffer = module.exports.isBuffer = Buffer.isBuffer;

var isArray = module.exports.isArray = Array.isArray;

var isPromise = module.exports.isPromise = function(val) {
  return (typeof val === 'object' || typeof val === 'function') && typeof val.then === 'function';
};

var isVinyl = module.exports.isVinyl = function(file) {
  return file && file._isVinyl === true;
};

module.exports.toStream = function toStream(s) {
  if (!s || isStream(s) || isBuffer(s) || isPromise(s) || isString(s)) {
    return s;
  }

  if (isHTTPStream(s)) {
    return new Promise(function(resolve, reject) {
      s.on('response', resolve).end();
      s.on('error', reject);
    });
  }

  var wrap = new ReadableStream().wrap(s);
  if (s.destroy) {
    wrap.destroy = s.destroy.bind(s);
  }

  return wrap;
};

module.exports.getFileName = function getFileName(value) {
  var name;

  if (Buffer.isBuffer(value)) {
    return 'file.' + mime(value, 'application/octet-stream').ext;
  }

  var filename = value.filename || value.fileName || value.path;

  if (filename) {
    name = path.basename(filename);
  }

  return name || 'file.bin';
};

module.exports.getContentType = function getContentType(opts) {
  var contentType;

  if (opts.contentType) {
    contentType = opts.contentType;
  } else {
    contentType = mime(opts.fileName || opts.filename, 'application/octet-stream').mime;
  }

  return contentType;
};
