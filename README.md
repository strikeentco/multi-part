multi-part [![License](https://img.shields.io/github/license/strikeentco/multi-part.svg)](https://github.com/strikeentco/multi-part/blob/master/LICENSE) [![npm](https://img.shields.io/npm/v/multi-part.svg)](https://www.npmjs.com/package/multi-part)
==========
[![Build Status](https://travis-ci.org/strikeentco/multi-part.svg)](https://travis-ci.org/strikeentco/multi-part) [![node](https://img.shields.io/node/v/multi-part.svg)](https://www.npmjs.com/package/multi-part) [![Test Coverage](https://codeclimate.com/github/strikeentco/multi-part/badges/coverage.svg)](https://codeclimate.com/github/strikeentco/multi-part/coverage) [![bitHound Score](https://www.bithound.io/github/strikeentco/multi-part/badges/score.svg)](https://www.bithound.io/github/strikeentco/multi-part)

A `multi-part` library allows you to create multipart/form-data `stream` or `buffer` which can be used to submit forms and file uploads to other web applications.

## Install
```sh
npm install multi-part
```

## Usage
Usage with `got`:

```js
var got = require('got');
var Multipart = require('multi-part'); //simmilar to require('multi-part').stream
var form = new Multipart();

form.append('photo', got.stream('https://avatars1.githubusercontent.com/u/2401029'));
form.append('field', 'multi-part test');
got.post('127.0.0.1:3000', form.getWithOptions());
```
Usage with `http`/`https`:

```js
var http = require('http');
var https = require('https');
var Multipart = require('multi-part'); //simmilar to require('multi-part').stream
var form = new Multipart();

form.append('photo', https.request('https://avatars1.githubusercontent.com/u/2401029'));
var multipart = form.getWithOptions({hostname: '127.0.0.1', port: 3000, method: 'POST'});
multipart.body.pipe(http.request(multipart));
```

# API

You can use `multi-part` in two ways: [stream](#stream-mode) or [buffer](#buffer-mode) modes.

## Stream mode

### new Multipart([options])

Constructor, can be found in `require('multi-part')` or `require('multi-part').stream`.

### Params:
* **[options]** (*Object*) - `Object` with options:
  * **boundary**  (*String|Number*) - Custom boundary for `multipart` data. Ex: if equal `CustomBoundary`, boundary will be equal exactly `CustomBoundary`.
  * **boundaryPrefix** (*String|Number*) - Custom boundary prefix for `multipart` data. Ex: if equal `CustomBoundary`, boundary will be equal something like `--CustomBoundary567689371204`.

### .append(name, value, [options])

Adds a new data to the `multipart/form-data` stream.

### Params:
* **name** (*String|Number*) - Field name. Ex: `photo`.
* **value** (*Mixed*) - Value can be String, Number, Array, Buffer, ReadableStream or even [Vynil](https://www.npmjs.com/package/vinyl).
* **[options]** (*Object*) - Additional options:
  * **filename**  (*String*) - File name. If you append a remote stream is recommended to specify file name with extension, otherwise `file.bin` will be set. Ex: `anonim.jpg`.
  * **contentType** (*String*) - File content type. It's not necessary, if you already specify file name, but you can provide content type of remote stream. If you not sure of content type - leave `filename` and `contentType` empty and it will be automatically determined as `file.bin` and `application/octet-stream`. Ex: `image/jpeg`.

If `value` is an array, append will be called for each value:
```js
form.append('array', [0, [2, 3], 1]);

//simmilar to

form.append('array', 0);
form.append('array', 2);
form.append('array', 3);
form.append('array', 1);
```

`Null`, `false` and `true` will be converted to `'0'`, `'0'` and `'1'`. Numbers will be converted to strings also.

For `Buffer` content type will be automatically determined, if it's possible, and name will be specified according to content type. If content type is `image/jpeg`, file name will be set as `file.jpeg` (if `filename` option is not specified).<br>In case content type is undetermined, content type and file name will be set as `application/octet-stream` and `file.bin`.

### .get() or .getMultipart()

Returns a `multipart/form-data` stream.

### .getWithOptions([options]) or .getMultipartWithOptions([options])

Returns the object:
```js
{
  headers: {
    transfer-encoding: 'chunked',
    content-type: 'multipart/form-data; boundary="--MultipartBoundary352840693617"'
  },
  body: Stream()
}
```

Where:
  - `headers` - HTTP request headers.
  - `body` - A `multipart/form-data` stream.

### Params:
* **[options]** (*Object*) - `Object` which will be mixed to return object.

### .getBoundary()

Returns the form boundary used in the `multipart/form-data` stream.

### .getHeaders()

Returns the headers which are similar to `getWithOptions().headers`.

## Buffer mode

### new Multipart([options])

Constructor, can be found in `require('multi-part').buffer`.

### Params:
* **[options]** (*Object*) - `Object` with options:
  * **chunked**  (*Boolean*) - If `false` `transfer-encoding` will be removed and `content-length` will be added to headers object. By default `true`.
  * **boundary**  (*String|Number*) - Custom boundary for `multipart` data. Ex: if equal `CustomBoundary`, boundary will be equal exactly `CustomBoundary`.
  * **boundaryPrefix** (*String|Number*) - Custom boundary prefix for `multipart` data. Ex: if equal `CustomBoundary`, boundary will be equal something like `--CustomBoundary567689371204`.

### .append(name, value, [options])

Adds a new data to the `multipart/form-data` buffer.

### Params:
* **name** (*String|Number*) - Field name. Ex: `photo`.
* **value** (*Mixed*) - Value can be String, Number, Array, Buffer, ReadableStream or even [Vynil](https://www.npmjs.com/package/vinyl).
* **[options]** (*Object*) - Additional options:
  * **filename**  (*String*) - File name. Ex: `anonim.jpg`.
  * **contentType** (*String*) - File content type. If you not sure of content type - leave `filename` and `contentType` empty and it will be automatically determined. Ex: `image/jpeg`.

If `value` is an array, append will be called for each value:
```js
form.append('array', [0, [2, 3], 1]);

//simmilar to

form.append('array', 0);
form.append('array', 2);
form.append('array', 3);
form.append('array', 1);
```

`Null`, `false` and `true` will be converted to `'0'`, `'0'` and `'1'`. Numbers will be converted to strings also.

All data, including `streams`, will be converted to `Buffer`, so in most case it's possible to automatically determine content type, in case content type is undetermined, it will be set as `application/octet-stream`.

### .get([options], [callback]) or .getMultipart([options], [callback])

> Unlike stream mode, in buffer mode all data will be converted to `Buffer` and placed in memory, this is asynchronous operation.

If you don't specify a `callback`, a `Promise` will be returned. Otherwise method will be processed as typical node `callback`.

Returns a `multipart/form-data` stream.

### .getWithOptions([options], [callback]) or .getMultipartWithOptions([options], [callback])

> Unlike stream mode, in buffer mode all data will be converted to `Buffer` and placed in memory, this is asynchronous operation.

If you don't specify a `callback`, a `Promise` will be returned. Otherwise method will be processed as typical node `callback`.

Returns the object:
```js
{
  headers: {
    transfer-encoding: 'chunked',
    content-type: 'multipart/form-data; boundary="--MultipartBoundary352840693617"'
  },
  body: Buffer()
}
```

Where:
  - `headers` - HTTP request headers.
  - `body` - A `multipart/form-data` buffer.

### Params:
* **[options]** (*Object*) - `Object` which will be mixed to return object.

### .getBoundary()

Returns the form boundary used in the `multipart/form-data` buffer.

### .getHeaders()

> If in constructor you specified `options.chunked` as `false` you should call this method only inside `callback` or `Promise` of `getMultipart()` and `getWithOptions()`, otherwise `content-length` will be wrong.

Returns the headers which are similar to `getWithOptions().headers`.

## Examples

Usage with `got`:

```js
var got = require('got');
var Multipart = require('multi-part').buffer;
var form = new Multipart();

form.append('field', 'multi-part test');
form.append('photo', [
  got.stream('https://avatars1.githubusercontent.com/u/2401029'),
  got.stream('https://avatars1.githubusercontent.com/u/1024980')
]);
form.append('field', 'multi-part test');

form.getWithOptions({json: true}).then(function(data) {
  return got.post('127.0.0.1:3000', data);
}).then(function(res) {
  console.log(res.body); //res.body will be parsed by `got` as json
});
```

Usage with `http`/`https`:

```js
var http = require('http');
var https = require('https');
var Multipart = require('multi-part').buffer;
var form = new Multipart({chunked: false});

form.append('photo', [
  https.get('https://avatars1.githubusercontent.com/u/2401029'),
  https.request('https://avatars1.githubusercontent.com/u/1024980')
], {filename: 'image.jpg', contentType: 'image/jpeg'});

console.log(form.getHeaders()); //content-length will be 0 - wrong
form.getWithOptions({hostname: '127.0.0.1', port: 3000, method: 'POST'}, function(err, data) {
  console.log(form.getHeaders()); //content-length will be 59452 - correct!
  http.request(data).end(data.body); //in data will be options from getWithOptions + headers for request
});
```

## License

The MIT License (MIT)<br/>
Copyright (c) 2015 Alexey Bystrov
