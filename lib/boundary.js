'use strict';

function Boundary(prefix) {
  if (!(this instanceof Boundary)) {
    return new Boundary(prefix);
  }

  this.prefix = prefix || 'MultipartBoundary';
  this.boundary = '';
  this.generate();
}

Boundary.prototype.get = function() {
  return this.boundary;
};

Boundary.prototype.generate = function() {
  this.boundary = '--' + this.prefix;
  for (var i = 0; i < 12; i++) {
    this.boundary += Math.floor(Math.random() * 10).toString(16);
  }

  return this;
};

module.exports = Boundary;
