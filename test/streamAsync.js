'use strict';

const should = require('should/as-function');
const http = require('http');
const https = require('https');
const fs = require('fs');
const Stream = require('stream');

const File = require('vinyl');
const got = require('got');
const app = require('express')();
const multer = require('multer');

const { MultipartAsync: Multipart } = require('../main');

const upload = multer({ dest: `${__dirname}/uploads/` });
const photoFile = `${__dirname}/fixture/fixture.jpg`;

function chunkSync(data, length) {
  const buf = Buffer.alloc(length);
  const fd = fs.openSync(data.path, data.flags);

  fs.readSync(fd, buf, 0, length);
  fs.closeSync(fd);

  return buf;
}

const photoVinyl = new File({
  path: 'anon.jpg',
  contents: chunkSync({ path: photoFile, flags: 'r' }, 9379)
});

describe('multi-part.async().stream()', function () {
  let server;
  this.timeout(10000);
  before((done) => {
    app.post('/', upload.single('photo'), (req, res) => {
      if (req.file) {
        return res.json({
          filename: req.file.originalname,
          mime: req.file.mimetype,
          fields: req.body
        });
      }
      return res.json('Nothing');
    });

    server = http.createServer(app);
    server.listen(4000, done);
  });

  after(() => server.close());

  describe('get custom boundary', () => {
    it('should be ok', () => {
      const form = new Multipart({ boundary: '--CustomBoundary12345' });
      should(form.getBoundary()).be.eql('--CustomBoundary12345');
      should(form.getHeaders()).be.eql({
        'transfer-encoding': 'chunked',
        'content-type': 'multipart/form-data; boundary="--CustomBoundary12345"'
      });
    });
  });

  describe('append nothing', () => {
    it('should be ok', async () => {
      const form = new Multipart();
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('"Nothing"');
      });
    });

    it('should be ok', (done) => {
      const form = new Multipart();
      const req = http.request({
        headers: form.getHeaders(), hostname: '127.0.0.1', port: 4000, method: 'POST'
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          should(Buffer.concat(chunks).toString('utf8')).be.eql('"Nothing"');
          done();
        });
      });
      form.stream().then(body => body.pipe(req));
    });

    it('should throw', () => {
      const form = new Multipart();
      should(() => form.append({}, null)).throw('Field must be specified and must be a string or a number');
      should(() => form.append('test')).throw('Value can\'t be undefined');
    });
  });

  describe('append vinyl', () => {
    it('should be ok', async () => {
      const form = new Multipart();
      form.append('photo', photoVinyl);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(JSON.parse(res.body)).be.eql({ filename: 'anon.jpg', mime: 'image/jpeg', fields: {} });
      });
    });

    it('should be ok', async () => {
      const form = new Multipart();
      form.append('photo', photoVinyl, { filename: 'anon.jpg' });
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(JSON.parse(res.body)).be.eql({ filename: 'anon.jpg', mime: 'image/jpeg', fields: {} });
      });
    });

    it('should be ok', (done) => {
      const form = new Multipart();
      form.append('photo', photoVinyl);
      const req = http.request({
        headers: form.getHeaders(), hostname: '127.0.0.1', port: 4000, method: 'POST'
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          should(JSON.parse(Buffer.concat(chunks).toString('utf8'))).be.eql({ filename: 'anon.jpg', mime: 'image/jpeg', fields: {} });
          done();
        });
      });
      form.stream().then(body => body.pipe(req));
    });
  });

  describe('append array', () => {
    it('should be ok', async () => {
      const form = new Multipart();
      form.append('array', ['arr', ['arr1', 'arr2'], 'arr3', null]);
      form.append('photo', photoVinyl);
      form.append('array', []);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(JSON.parse(res.body)).be.eql({ filename: 'anon.jpg', mime: 'image/jpeg', fields: { array: ['arr', 'arr1', 'arr2', 'arr3', '0', ''] } });
      });
    });

    it('should be ok', (done) => {
      const form = new Multipart();
      form.append('array', ['arr', ['arr1', 'arr2'], 'arr3', null]);
      form.append('photo', photoVinyl);
      form.append('array', []);
      const req = http.request({
        headers: form.getHeaders(), hostname: '127.0.0.1', port: 4000, method: 'POST'
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          should(JSON.parse(Buffer.concat(chunks).toString('utf8'))).be.eql({ filename: 'anon.jpg', mime: 'image/jpeg', fields: { array: ['arr', 'arr1', 'arr2', 'arr3', '0', ''] } });
          done();
        });
      });
      form.stream().then(body => body.pipe(req));
    });
  });

  describe('append stream', () => {
    it('should be ok', async () => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', fs.createReadStream(photoFile));
      form.append('field', null);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(JSON.parse(res.body)).be.eql({ filename: 'fixture.jpg', mime: 'image/jpeg', fields: { field: ['12345', '0'] } });
      });
    });

    it('should be ok', async () => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', fs.createReadStream(photoFile), { filename: 'a.jpg', contentType: 'image/jpeg' });
      form.append('field', null);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
      });
    });

    it('should be ok', async () => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', fs.createReadStream(photoFile), { filename: 'a.jpg' });
      form.append('field', null);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
      });
    });

    it('should be ok', async () => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', fs.createReadStream(photoFile), { contentType: 'image/jpeg' });
      form.append('field', null);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('{"filename":"fixture.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
      });
    });

    it('should be ok', async () => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', https.request('https://avatars1.githubusercontent.com/u/2401029'));
      form.append('field', null);
      let body = await form.stream();
      await got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('{"filename":"2401029","mime":"application/octet-stream","fields":{"field":["12345","0"]}}');
      });
      body = await form.stream();
      await got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('"Nothing"');
      });
    });

    it('should be ok', (done) => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', https.request('https://avatars1.githubusercontent.com/u/2401029'));
      form.append('field', null);
      const req = http.request({
        headers: form.getHeaders(), hostname: '127.0.0.1', port: 4000, method: 'POST'
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          should(Buffer.concat(chunks).toString('utf8')).be.eql('{"filename":"2401029","mime":"application/octet-stream","fields":{"field":["12345","0"]}}');
          done();
        });
      });
      form.stream().then(body => body.pipe(req));
    });

    it('should be ok', async () => {
      const stream = new Stream();
      stream.readable = true;

      setTimeout(() => {
        stream.emit('close');
        stream.emit('end');
      }, 50);

      const form = new Multipart();
      form.append('field', stream);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('"Nothing"');
      });
    });

    it('should be ok', async () => {
      const stream = new Stream();
      stream.readable = true;

      const form = new Multipart();
      form.append('field', stream);
      setTimeout(() => {
        // stream.emit('close');
        stream.emit('end');
        stream.emit('close');
      }, 50);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('"Nothing"');
      });
    });

    it('should throw', async () => {
      const stream = new Stream();
      stream.readable = true;
      stream.destroy = () => {
        stream.emit('end');
      };

      const form = new Multipart();
      form.append('field', stream);
      setTimeout(() => {
        stream.emit('error');
      }, 50);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).catch((e) => {
        should(e.message).be.eql('Response code 500 (Internal Server Error)');
      });
    });

    it('should be ok', async () => {
      const stream = new Stream();
      stream.readable = true;
      stream.destroy = () => {
        stream.emit('end');
      };

      stream.emit('data', 'Text');
      setTimeout(() => {
        stream.emit('end');
      }, 50);

      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', https.request('https://avatars1.githubusercontent.com/u/2401029'));
      form.append('field', stream);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('{"filename":"2401029","mime":"application/octet-stream","fields":{"field":["12345",""]}}');
      });
    });

    it('should be ok', (done) => {
      https.get('https://avatars1.githubusercontent.com/u/2401029')
        .on('response', async (photo) => {
          const form = new Multipart();
          form.append('field', 12345);
          form.append('photo', photo);
          form.append('field', null);
          const body = await form.stream();
          got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
            should(res.body).be.eql('{"filename":"file.bin","mime":"application/octet-stream","fields":{"field":["12345","0"]}}');
            done();
          });
        });
    });

    it('should throw', () => {
      const form = new Multipart();
      form.append('photo', got.stream('http://127.0.0.1', { retries: 0 }));
      return form.stream().catch(e => should(e.message).startWith('connect ECONNREFUSED'));
    });

    it('should throw', () => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('field', null);
      form._append = {};
      return form.stream().catch(e => should(e.message).startWith('this._append is not a function'));
    });

    it('should throw', (done) => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', http.request({ hostname: '127.0.0.1' }));
      form.append('photo', fs.createReadStream(photoFile));
      form.append('field', null);
      form.once('error', (e) => {
        should(e.message).startWith('connect ECONNREFUSED');
        done();
      });
      form.stream();
    });
  });

  describe('append buffer', () => {
    const photoBuffer = chunkSync({ path: photoFile, flags: 'r' }, 9379);
    it('should be ok', async () => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', photoBuffer);
      form.append('field', null);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('{"filename":"file.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
      });
    });

    it('should be ok', async () => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', photoBuffer, { filename: 'a.jpg', contentType: 'image/jpeg' });
      form.append('field', null);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
      });
    });

    it('should be ok', async () => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', photoBuffer, { filename: 'a.jpg' });
      form.append('field', null);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('{"filename":"a.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
      });
    });

    it('should be ok', async () => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', photoBuffer, { contentType: 'image/jpeg' });
      form.append('field', null);
      const body = await form.stream();
      return got.post('http://127.0.0.1:4000', { headers: form.getHeaders(), body }).then((res) => {
        should(res.body).be.eql('{"filename":"file.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
      });
    });

    it('should be ok', (done) => {
      const form = new Multipart();
      form.append('field', 12345);
      form.append('photo', photoBuffer);
      form.append('field', null);
      const req = http.request({
        headers: form.getHeaders(), hostname: '127.0.0.1', port: 4000, method: 'POST'
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          should(Buffer.concat(chunks).toString('utf8')).be.eql('{"filename":"file.jpg","mime":"image/jpeg","fields":{"field":["12345","0"]}}');
          done();
        });
      });
      form.stream().then(body => body.pipe(req));
    });
  });
});
