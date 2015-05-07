'use strict';

require('loadenv')('optimus:env');
var monitor = require('monitor-dog');
var async = require('async');
var exists = require('101/exists');
var Transformer = require('fs-transform');
var repository = require('./repository');
var deployKey = require('./deploy-key');
var cache = require('./cache');

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
 * @param {string} req.params.deployKeyPath Repos' S3 deploy key path.
 * @param {array} req.body An array of fs-transform rules to apply.
 * @param {object} res The response object.
 */
function applyRules(req, res) {
  if (!exists(req.params.repo)) {
    return res.boom.badRequest('Parameter `repo` is required.');
  }

  if (!req.params.repo.match(/git@github\.com:([^\/]+)\/(.+)/)) {
    return res.boom.badRequest(
      'Parameter `repo` is not in the form: ' +
      'git@github.com:Organization/Repository'
    );
  }

  if (!exists(req.params.commitish)) {
    return res.boom.badRequest('Parameter `commitish` is required.');
  }

  if (!exists(req.params.deployKeyPath)) {
    return res.boom.badRequest('Parameter `deployKeyPath` is required.');
  }

  if (!Array.isArray(req.body)) {
    return res.boom.badRequest('Body must be an array of transform rules.');
  }

  var tasks = [
    // 1. Fetch deploy key for the repository
    function fetchDeployKey(next) {
      var fetchDeployKeyTimer = monitor.timer('key.time');
      deployKey.fetch(req.params.deployKeyPath, function (err) {
        fetchDeployKeyTimer.stop();
        next(err);
      });
    },

    // 2. Clone the repository we wish to transform
    function fetchRepository(next) {
      var fetchRepositoryTimer = monitor.timer('repository.time');
      repository.fetch(
        req.params.deployKeyPath,
        req.params.repo,
        req.params.commitish,
        function (err, path) {
          fetchRepositoryTimer.stop();
          next(err, path);
        }
      );
    },

    // 3. Execute transformations
    function transformRepository(path, next) {
      var transformTimer = monitor.timer('transform.time');
      Transformer.dry(path, req.body, function (err, transformer) {
        transformTimer.stop();
        if (err) { return next(err); }
        cache.unlock(path, function (err) {
          next(err, transformer);
        });
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
