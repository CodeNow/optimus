'use strict';

require('loadenv')('optimus:env');
var monitor = require('monitor-dog');
var Transformer = require('fs-transform');
var repository = require('./repository');
var async = require('async');
var exists = require('101/exists');

/**
 * Performs file transformations on user repositories.
 * @module optimus:transform
 * @author Ryan Sandor Richards
 */
module.exports = { applyRules: applyRules };

/**
 * Applies an array of transform rules to the given user repository.
 *
 * @example
 * // JSON Response...
 * {
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
 * @param {string} req.params.repo Name of the user repository.
 * @param {string} req.params.commitish A commit hash or branch.
 * @param {array} req.body An array of fs-transform rules to apply.
 * @param {object} res The response object.
 */
function applyRules(req, res) {
  if (!exists(req.params.repo)) {
    return res.boom.badRequest('Parameter `repo` is required.');
  }

  if (!exists(req.params.commitish)) {
    return res.boom.badRequest('Parameter `commitish` is required.');
  }

  if (!Array.isArray(req.body)) {
    return res.boom.badRequest('Body must be an array of transform rules.');
  }

  var tasks = [
    // 1. Ensure we have a copy of the repository we want to transform
    function fetchRepository(next) {
      var fetchTimer = monitor.timer('fetch.time');
      repository.fetch(
        req.params.repo,
        req.params.commitish,
        function (err, path) {
          fetchTimer.stop();
          next(err, path);
        }
      );
    },

    // 2. Execute transformations on the repository
    function transformRepository(path, next) {
      var transformTimer = monitor.timer('transform.time');
      Transformer.dry(path, req.body, function (err, transformer) {
        transformTimer.stop();
        next(err, transformer);
      });
    }
  ];

  async.waterfall(tasks, function (err, transformer) {
    if (err) {
      return res.boom.badRequest(err);
    }
    res.json({
      warnings: transformer.warnings,
      diff: transformer.getDiff(),
      script: transformer.getScript()
    });
  });
}
