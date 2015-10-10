'use strict';

var fs = require('fs');
var File = require('vinyl');
var got = require('got');
var should = require('should/as-function');

var MultipartBuffer = require('../main').buffer;

var app = require('./_server');
var path = require('./_server').path;
var port = require('./_server').port;
var file = __dirname + '/anonim.jpg';

var photo = new File({
  path: 'anon.jpg',
  contents: chunkSync({path: file, flags: 'r'}, 9379)
});

function chunkSync(data, length) {
  var buf = new Buffer(length);
  var fd = fs.openSync(data.path, data.flags);

  fs.readSync(fd, buf, 0, length);
  fs.closeSync(fd);

  return buf;
}

var multipart;

describe('multi-part()', function() {
  this.timeout(10000);
  before(function() {
    app.listen(port + 1);
  });

  describe('as buffer mode', function() {
    describe('get custom boundary', function() {
      it('should be ok', function() {
        multipart = new MultipartBuffer({boundary: '--CustomBoundary12345'});
        should(multipart.getBoundary()).be.eql('--CustomBoundary12345');
        should(multipart.getHeaders()).be.eql({
          'transfer-encoding': 'chunked',
          'content-type': 'multipart/form-data; boundary="--CustomBoundary12345"'
        });
      });
    });

    describe('append nothing', function() {
      it('should be ok', function() {
        multipart = new MultipartBuffer();
        return multipart.getWithOptions().then(function(data) {
          return got.post('127.0.0.1:' + (port + 1), data);
        }).then(function(res) {
          should(res.body).be.eql('"Nothing"');
        });
      });

      it('should throw', function() {
        multipart = new MultipartBuffer();
        should(function() { return multipart.append({}, null);}).throw('Name must be specified and must be a string or a number');
      });
    });

    describe('append object', function() {
      it('should throw', function() {
        multipart = new MultipartBuffer();
        multipart.append('obj', {name: 'Hey', obj: {obj: 'Hey'}});
        return multipart.get().catch(function(e) {
          should(e.message).be.eql('Value should be Buffer, Stream, Array, String or Number');
        });
      });

      it('should throw', function(done) {
        multipart = new MultipartBuffer();
        multipart.append('obj', {name: 'Hey', obj: {obj: 'Hey'}});
        multipart.get(function(err) {
          should(err.message).be.eql('Value should be Buffer, Stream, Array, String or Number');
          done();
        });
      });
    });

    describe('append vinyl', function() {
      it('should be ok', function() {
        multipart = new MultipartBuffer();
        multipart.append('photo', photo);
        return multipart.getWithOptions({json: true}).then(function(data) {
          return got.post('127.0.0.1:' + (port + 1), data);
        }).then(function(res) {
          should(res.body).be.eql({filename:'anon.jpg', mime:'image/jpeg', fields:{}});
        });
      });
    });

    describe('append array', function() {
      it('should be ok', function() {
        multipart = new MultipartBuffer();
        multipart.append('array', ['arr', ['arr1', 'arr2'], 'arr3', null]);
        multipart.append('photo', photo);
        multipart.append('array', []);
        return multipart.getWithOptions({json: true}).then(function(data) {
          return got.post('127.0.0.1:' + (port + 1), data);
        }).then(function(res) {
          should(res.body).be.eql({filename:'anon.jpg', mime:'image/jpeg', fields:{array: ['arr', 'arr1', 'arr2', 'arr3', '0', '']}});
        });
      });
    });

    describe('append stream', function() {
      var stream;
      beforeEach(function() {
        stream = fs.createReadStream(file);
      });

      describe('without options', function() {
        it('should be ok', function() {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', stream);
          multipart.append('field', null);
          return multipart.getWithOptions({json: true}).then(function(data) {
            return got.post('127.0.0.1:' + (port + 1), data);
          }).then(function(res) {
            should(res.body).be.eql({filename: 'file.jpeg', mime: 'image/jpeg', fields: { field: ['12345','0']}});
          });
        });

        it('should be ok', function(done) {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', stream);
          multipart.append('field', null);
          multipart.getWithOptions(function(err, data) {
            got.post('127.0.0.1:' + (port + 1), data, function(err, res) {
              should(res).be.eql('{"filename":"file.jpeg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
              done();
            });
          });
        });

        it('should be ok', function(done) {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', stream);
          multipart.append('field', null);
          multipart.getMultipart(function(err, data) {
            got.post('127.0.0.1:' + (port + 1), {body: data, headers: multipart.getHeaders()}, function(err, res) {
              should(res).be.eql('{"filename":"file.jpeg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
              done();
            });
          });
        });

        it('should be ok', function() {
          multipart = new MultipartBuffer();
          multipart.append('photo', require('https').get('https://avatars1.githubusercontent.com/u/2401029'));
          return multipart.getWithOptions({json: true}).then(function(data) {
            return got.post('127.0.0.1:' + (port + 1), data);
          }).then(function(res) {
            should(res.body).be.eql({filename: 'file.jpeg', mime: 'image/jpeg', fields: {}});
          });
        });

        it('should throw', function(done) {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', got.stream('127.0.0.1:2000'));
          multipart.append('field', null);
          multipart.get(function(err, data) {
            if (err) {
              should(err.message).startWith('connect ECONNREFUSED');
              done();
            }
          });
        });

        it('should throw', function(done) {
          multipart = new MultipartBuffer();
          multipart.append('photo', require('http').request('http://127.0.0.1:2001'));
          multipart.get(function(err, data) {
            if (err) {
              should(err.message).startWith('connect ECONNREFUSED');
              done();
            }
          });
        });

        it('should throw', function(done) {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', stream);
          multipart.append('field', null);

          stream.on('end', function() {
            delete multipart._current;
          });

          multipart.get(function(err, data) {
            should(err.message).be.eql('list argument must be an Array of Buffers.');
            done();
          });
        });

        it('should throw', function() {
          multipart = new MultipartBuffer();
          multipart.append('photo', [stream, photo]);
          stream.on('data', function() {
            delete multipart._current;
          });

          return multipart.get().catch(function(err) {
            should(err.message).be.not.empty();
          });
        });
      });

      describe('with options', function() {
        it('should be ok', function() {
          multipart = new MultipartBuffer({chunked: false});
          multipart.append('field', 12345);
          multipart.append('photo', stream, {filename: 'a.jpg', contentType: 'image/jpeg'});
          multipart.append('field', null);
          return multipart.getWithOptions().then(function(data) {
            return got.post('127.0.0.1:' + (port + 1), data);
          }).then(function(res) {
            should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });

        it('should be ok', function() {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', stream, {filename: 'a.jpg'});
          multipart.append('field', null);
          return multipart.getWithOptions().then(function(data) {
            return got.post('127.0.0.1:' + (port + 1), data);
          }).then(function(res) {
            should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });

        it('should be ok', function() {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', stream, {contentType: 'image/jpeg'});
          multipart.append('field', null);
          return multipart.getWithOptions().then(function(data) {
            return got.post('127.0.0.1:' + (port + 1), data);
          }).then(function(res) {
            should(res.body).be.eql('{"filename":"file.jpeg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });
      });
    });

    describe('append buffer', function() {
      var buffer = chunkSync({path: file, flags: 'r'}, 9379);
      describe('without options', function() {
        it('should be ok', function() {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', buffer);
          multipart.append('field', null);
          return multipart.getWithOptions().then(function(data) {
            return got.post('127.0.0.1:' + (port + 1), data);
          }).then(function(res) {
            should(res.body).be.eql('{"filename":"file.jpeg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });

        it('should be ok', function(done) {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', buffer);
          multipart.append('field', null);
          multipart.getWithOptions({json: true}, function(err, data) {
            got.post('127.0.0.1:' + (port + 1), data, function(err, res) {
              should(res).be.eql({filename:'file.jpeg', mime:'image/jpeg', fields:{ field: ['12345','0']}});
              done();
            });
          });
        });
      });

      describe('with options', function() {
        it('should be ok', function() {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', buffer, {filename: 'a.jpg', contentType: 'image/jpeg'});
          multipart.append('field', null);
          return multipart.getWithOptions().then(function(data) {
            return got.post('127.0.0.1:' + (port + 1), data);
          }).then(function(res) {
            should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });

        it('should be ok', function() {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', buffer, {filename: 'a.jpg'});
          multipart.append('field', null);
          return multipart.getWithOptions().then(function(data) {
            return got.post('127.0.0.1:' + (port + 1), data);
          }).then(function(res) {
            should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });

        it('should be ok', function() {
          multipart = new MultipartBuffer();
          multipart.append('field', 12345);
          multipart.append('photo', buffer, {contentType: 'image/jpeg'});
          multipart.append('field', null);
          return multipart.getWithOptions().then(function(data) {
            return got.post('127.0.0.1:' + (port + 1), data);
          }).then(function(res) {
            should(res.body).be.eql('{"filename":"file.jpeg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });
      });
    });
  });

  /*after(function() {
    setTimeout(require('rimraf').sync(__dirname + '/uploads'), 150);
  });*/
});
