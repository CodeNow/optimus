'use strict'

const async = require('async')
const childProcess = require('child_process')
const applicationRoot = require('app-root-path').toString()

/**
 * Environment variable names for each cache path.
 * @type Array
 */
const cachePaths = [
  'REPOSITORY_CACHE',
  'COMMITISH_CACHE',
  'DEPLOY_KEY_CACHE'
]

/**
 * Names for each of the specific cache directories.
 * @type Array
 */
const cacheDirNames = {
  REPOSITORY_CACHE: 'repository',
  COMMITISH_CACHE: 'commitish',
  DEPLOY_KEY_CACHE: 'deploy_key'
}

/**
 * Stores the original cache environment variable paths.
 * @type Object
 */
const cacheEnv = {}

/**
 * Manual cache methods for functional testing.
 * @class
 * @author Ryan Sandor Richards
 */
module.exports = class FixtureCache {
  /**
   * Creates and initializes fixture caches for testing.
   * @param {function} done Callback to execute once caches have been
   *   initialized.
   */
  static create (done) {
    cachePaths.forEach(function (name) {
      cacheEnv[name] = process.env[name] || null
      process.env[name] = [
        applicationRoot,
        'test/fixtures/cache',
        cacheDirNames[name]
      ].join('/')
    })
    // TODO This is strange, why do we need to require here as opposed to above?
    require('../../lib/cache').initialize(done)
  }

  /**
   * Empties and resets the testing caches.
   * @param {function} done Called when the caches have been reset.
   */
  static reset (done) {
    FixtureCache.destroy(function (err) {
      if (err) { return done(err) }
      FixtureCache.create(done)
    })
  }

  /**
   * Removes fixture caches.
   * @param {function} done Callback to execute once the caches have been
   *   removed.
   */
  static destroy (done) {
    // TODO This seems dangerous, even for a testing environment... `-rf`
    async.map(cachePaths, function (name, cb) {
      childProcess.exec('rm -rf ' + process.env[name], function (err) {
        process.env[name] = cacheEnv[name]
        cb(err)
      })
    }, done)
  }
}
