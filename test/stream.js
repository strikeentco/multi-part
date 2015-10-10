'use strict';

var fs = require('fs');
var File = require('vinyl');
var got = require('got');
var should = require('should/as-function');

var MultipartStream = require('../main').stream;

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
    app.listen(port);
  });

  describe('as stream mode', function() {
    describe('get custom boundary', function() {
      it('should be ok', function() {
        multipart = new MultipartStream({boundary: '--CustomBoundary12345'});
        should(multipart.getBoundary()).be.eql('--CustomBoundary12345');
        should(multipart.getHeaders()).be.eql({
          'transfer-encoding': 'chunked',
          'content-type': 'multipart/form-data; boundary="--CustomBoundary12345"'
        });
      });
    });

    describe('append nothing', function() {
      it('should be ok', function() {
        multipart = new MultipartStream();
        return got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
          should(res.body).be.eql('"Nothing"');
        });
      });

      it('should throw', function() {
        multipart = new MultipartStream();
        should(function() { return multipart.append({}, null);}).throw('Name must be specified and must be a string or a number');
      });
    });

    describe('append vinyl', function() {
      it('should be ok', function() {
        multipart = new MultipartStream();
        multipart.append('photo', photo);
        return got.post('http://127.0.0.1:4000', multipart.getWithOptions({json: true})).then(function(res) {
          should(res.body).be.eql({filename:'anon.jpg', mime:'image/jpeg', fields:{}});
        });
      });
    });

    describe('append array', function() {
      it('should be ok', function() {
        multipart = new MultipartStream();
        multipart.append('array', ['arr', ['arr1', 'arr2'], 'arr3', null]);
        multipart.append('photo', photo);
        multipart.append('array', []);
        return got.post('http://127.0.0.1:4000', multipart.getWithOptions({json: true})).then(function(res) {
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
          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('photo', stream);
          multipart.append('field', null);
          multipart.get();
          return got.post('http://127.0.0.1:4000', multipart.getWithOptions({json: true})).then(function(res) {
            should(res.body).be.eql({filename:'anonim.jpg', mime:'image/jpeg', fields:{ field: ['12345','0']}});
          });
        });

        it('should be ok', function() {
          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('photo', require('https').request('https://avatars1.githubusercontent.com/u/2401029'));
          multipart.append('field', null);
          return got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
            should(res.body).be.eql('{"filename":"2401029","mime":"application/octet-stream","fields":{"field":["12345","0"]}}');
          });
        });

        it('should be ok', function() {
          var OldStream = require('stream');
          var stream = new OldStream;
          stream.readable = true;
          stream.emit('data', 'Text');
          setTimeout(function() {
            stream.emit('end');
          }, 50);

          multipart = new MultipartStream();
          multipart.append('field', stream);
          return got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
            should(res.body).be.eql('"Nothing"');
          });
        });

        it('should be ok', function() {
          var OldStream = require('stream');
          var stream = new OldStream;
          stream.readable = true;
          stream.destroy = function() {
            stream.emit('end');
          };

          stream.emit('data', 'Text');
          setTimeout(function() {
            stream.emit('end');
          }, 50);

          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('photo', require('https').request('https://avatars1.githubusercontent.com/u/2401029'));
          multipart.append('field', stream);
          return got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
            should(res.body).be.eql('{"filename":"2401029","mime":"application/octet-stream","fields":{"field":["12345",""]}}');
          });
        });

        it('should be ok', function(done) {
          var req = require('https').get('https://avatars1.githubusercontent.com/u/2401029');
          req.on('response', function(photo) {
            multipart = new MultipartStream();
            multipart.append('field', 12345);
            multipart.append('photo', photo);
            multipart.append('field', null);
            got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
              should(res.body).be.eql('{"filename":"file.bin","mime":"application/octet-stream","fields":{"field":["12345","0"]}}');
              done();
            });
          });
        });

        it('should throw', function(done) {
          multipart = new MultipartStream();
          multipart.append('photo', got.stream('http://127.0.0.1:1001'));
          multipart.get().on('error', function(err) {
            should(err.message).startWith('connect ECONNREFUSED');
            done();
          });
        });

        it('should throw', function() {
          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('field', null);
          multipart._append = {};
          should(function() { return multipart.get();}).throw();
        });

        it('should throw', function(done) {
          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('photo', require('http').request('http://127.0.0.1'));
          multipart.append('photo', fs.createReadStream(file));
          multipart.append('field', null);
          multipart.get().on('error', function(e) {
            should(e.message).startWith('connect ECONNREFUSED');
            done();
          });
        });
      });

      describe('with options', function() {
        it('should be ok', function() {
          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('photo', stream, {filename: 'a.jpg', contentType: 'image/jpeg'});
          multipart.append('field', null);
          return got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
            should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });

        it('should be ok', function() {
          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('photo', stream, {filename: 'a.jpg'});
          multipart.append('field', null);
          return got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
            should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });

        it('should be ok', function() {
          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('photo', stream, {contentType: 'image/jpeg'});
          multipart.append('field', null);
          return got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
            should(res.body).be.eql('{"filename":"anonim.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });
      });
    });

    describe('append buffer', function() {
      var buffer = chunkSync({path: file, flags: 'r'}, 9379);
      describe('without options', function() {
        it('should be ok', function() {
          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('photo', buffer);
          multipart.append('field', null);
          return got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
            should(res.body).be.eql('{"filename":"file.jpeg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });
      });

      describe('with options', function() {
        it('should be ok', function() {
          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('photo', buffer, {filename: 'a.jpg', contentType: 'image/jpeg'});
          multipart.append('field', null);
          return got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
            should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });

        it('should be ok', function() {
          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('photo', buffer, {filename: 'a.jpg'});
          multipart.append('field', null);
          return got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
            should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });

        it('should be ok', function() {
          multipart = new MultipartStream();
          multipart.append('field', 12345);
          multipart.append('photo', buffer, {contentType: 'image/jpeg'});
          multipart.append('field', null);
          return got.post('http://127.0.0.1:4000', multipart.getWithOptions()).then(function(res) {
            should(res.body).be.eql('{"filename":"file.jpeg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          });
        });
      });
    });
  });

  after(function() {
    setTimeout(require('rimraf').sync(__dirname + '/uploads'), 300);
  });
});
