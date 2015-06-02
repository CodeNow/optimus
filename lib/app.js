'use strict';

require('loadenv')('optimus:env');
var express = require('express');
var monitor = require('monitor-dog');
var envIs = require('101/env-is');

var transform = require('./transform');
var logger = require('./logger');

/**
 * The optimus application singleton.
 * @module optimus:app
 * @author Ryan Sandor Richards
 */
module.exports = {
  getInstance: getInstance
};

/**
 * Optimus middlewares.
 * @type {Object}
 */
var middleware = {
  connectDatadog: require('connect-datadog'),
  expressBoom: require('express-boom'),
  bodyParser: require('body-parser'),
  applyRules: function () {
    return transform.applyRules;
  },
  notFound: function () {
    return function (req, res) { res.boom.notFound(); };
  },
  logger: require('express-bunyan-logger')
};

/**
 * Optimus express application.
 * @type {Object}
 */
var app = express();

/**
 * Whether or not the singleton instance has been initialized.
 * @type {boolean}
 */
var initialized = false;

/**
 * Initializes the application instance.
 * @return {object} The optimus express application.
 */
function getInstance() {
  // These are being tested via rewire, which has weird interactions with lab's
  // coverage tool. Turning it off to get 100% in the test run.
  // $lab:coverage:off$
  if (initialized) { return app; }
  initialized = true;

  if (envIs('production')) {
    app.use(middleware.connectDatadog({
      'dogstatsd': monitor,
      'response_code': true,
      'method': true,
      'tags': ['name:optimus', 'logType:express', 'env:' + process.env.NODE_ENV]
    }));
  }
  // $lab:coverage:on$

  app.use(middleware.logger({ logger: logger }));
  app.use(middleware.expressBoom());
  app.use(middleware.bodyParser.json());
  app.put('/', middleware.applyRules());
  app.use(middleware.notFound());

  return app;
}
