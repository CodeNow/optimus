'use strict';

require('loadenv')('optimus:env');
var express = require('express');
var monitor = require('monitor-dog');
var envIs = require('101/env-is');
var transform = require('./transform');

/**
 * Optimus RESTful interface.
 * @module optimus:app
 * @author Ryan Sandor Richards
 */
var app = module.exports = express();

if (envIs('production')) {
  app.use(require('connect-datadog')({
    'dogstatsd': monitor,
    'response_code': true,
    'method': true,
    'tags': ['name:optimus', 'logType:express', 'env:' + process.env.NODE_ENV]
  }));
}

app.use(require('express-boom')());
app.use(require('body-parser').json());

app.put('/', transform.applyRules);
// TODO app.delete('/keys', ...)
// TODO app.delete('/working', ...)

app.use(function (req, res) { res.boom.notFound(); });
