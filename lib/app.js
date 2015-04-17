'use strict';

require('loadenv')('optimus:env');
var express = require('express');
var bodyParser = require('body-parser');
var boom = require('express-boom');
var exists = require('101/exists');
var monitor = require('monitor-dog');

/**
 * Optimus RESTful interface.
 * @module optimus:app
 * @author Ryan Sandor Richards
 */
var app = module.exports = express();

/**
 * PUT /
 *
 * Default method for the application. Given a repository (`req.params.repo`)
 * and an array of transformation rules (json in the `req.body`) this will
 * perform the transformations and return the results.
 *
 * The JSON response is formatted as such:
 *
 * {
 *   // errors that occurred during processing
 *   errors: [],
 *
 *   // warnings generated during processing
 *   warnings: [],
 *
 *   // list of file/text diffs after transformations
 *   diff: [],
 *
 *   // shell script result of the transformation (for use in dockerfiles)
 *   script: ""
 * }
 *
 * @param {object} req Request object.
 * @param {object} res Response object.
 */
function put(req, res) {
  monitor.increment('request');
  var timer = monitor.timer('request.time');

  if (!exists(req.params.repo)) {
    return res.boom.badRequest('Parameter `repo` is required.');
  }
  if (!Array.isArray(req.body)) {
    return res.boom.badRequest('Body must be an array of transform rules.');
  }

  var repository = req.params.repo;
  var rules = req.body;

  var response = {
    errors: [],
    warnings: [],
    diff: [],
    script: ""
  };

  // Get a copy of the repository
  // TODO Implement me...

  // Perform transformations on the repository
  // TODO Implement me...

  // Respond with results
  res.json(response);
  timer.stop();
}

app.use(bodyParser.json());   // Parse body as JSON
app.use(boom());              // Use Boom for error responses
app.put('/', put);            // Set default method
