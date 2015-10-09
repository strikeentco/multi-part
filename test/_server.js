'use strict';

var express = require('express');
var multer  = require('multer');
var upload = multer({ dest: __dirname + '/uploads/'});
var protocol = 'http://';
var port = 4000;
var path = '127.0.0.1' + ':' + port;
var app = express();

app.post('/', upload.single('photo'), function(req, res) {
  if (req.file) {
    res.json({filename: req.file.originalname, mime: req.file.mimetype, fields: req.body});
  } else {
    res.json('Nothing');
  }
});

module.exports = app;
module.exports.path = path;
module.exports.protocol = protocol;
module.exports.port = port;
