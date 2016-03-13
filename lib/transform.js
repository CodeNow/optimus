'use strict'

require('loadenv')('optimus:env')

const cache = require('./cache')
const deployKey = require('./deploy-key')
const exists = require('101/exists')
const logger = require('./logger').child({ module: 'transform' })
const monitor = require('monitor-dog')
const Promise = require('bluebird')
const repository = require('./repository')
const RouteError = require('error-cat/errors/route-error')
const Transformer = require('fs-transform')

/**
 * Applies an array of transform rules to the given user repository.
 *
 * @example
 * // JSON Response...
 * {
 *   // warnings generated during processing
 *   warnings: [],
 *
 *   // Full repository diff after transformation
 *   diff: '',
 *
 *   // shell script result of the transformation (for use in dockerfiles)
 *   script: "",
 *
 *   // Result information by rule
 *   results: []
 * }
 *
 * @param {string} req.query.repo Name of the user repository.
 * @param {string} req.query.commitish A commit hash or branch.
 * @param {string} req.query.deployKey Repos' S3 deploy key path.
 * @param {array} req.body An array of fs-transform rules to apply.
 * @param {object} res The response object.
 */
function applyRules (req, res, next) {
  const log = logger.child({ method: 'applyRules' })
  Promise
    .try(() => {
      if (!exists(req.query.repo)) {
        throw new RouteError('Parameter `repo` is required.', 400)
      }

      if (!req.query.repo.match(/git@github\.com:([^\/]+)\/(.+)/)) {
        throw new RouteError(
          'Parameter `repo` is not in the form: ' +
          'git@github.com:Organization/Repository',
          400
        )
      }

      if (!exists(req.query.commitish)) {
        throw new RouteError('Parameter `commitish` is required.', 400)
      }

      if (!exists(req.query.deployKey)) {
        throw new RouteError('Parameter `deployKey` is required.', 400)
      }

      if (!Array.isArray(req.body)) {
        throw new RouteError('Body must be an array of transform rules.', 400)
      }
    })
    .then(function fetchDeployKey () {
      var fetchDeployKeyTimer = monitor.timer('key.time')
      return deployKey.fetch(req.query.deployKey)
        .then((keyPath) => {
          fetchDeployKeyTimer.stop()
          return keyPath
        })
    })
    .then(function fetchRepository (keyPath) {
      var fetchRepositoryTimer = monitor.timer('repository.time')
      return repository.fetch(keyPath, req.query.repo, req.query.commitish)
        .then(function (path) {
          fetchRepositoryTimer.stop()
          return path
        })
    })
    .then(function transformRepository (path) {
      var transformTimer = monitor.timer('transform.time')
      return Promise
        .fromCallback((cb) => {
          log.debug('Applying transform rules')
          Transformer.dry(path, req.body, cb)
        })
        .then((transformer) => {
          transformTimer.stop()
          return cache.unlock(path).then(() => { return transformer })
        })
    })
    .then((transformer) => {
      const response = {
        warnings: transformer.warnings,
        diff: transformer.getDiff(),
        results: transformer.results,
        script: transformer.getScript()
      }
      log.debug({ reponse: response }, 'Sending results')
      res.json(response)
    })
    .catch(next)
}

module.exports = { applyRules: applyRules }
