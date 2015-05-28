'use strict';

var async = require('async');
var childProcess = require('child_process');
var applicationRoot = require('app-root-path').toString();

/**
 * Manual cache methods for functional testing.
 * @module optimus:test
 * @author Ryan Sandor Richards
 */
module.exports = {
  create: create,
  destroy: destroy,
  reset: reset
};

/**
 * Environment variable names for each cache path.
 * @type Array
 */
var cachePaths = [
  'REPOSITORY_CACHE',
  'COMMITISH_CACHE',
  'DEPLOY_KEY_CACHE'
];

/**
 * Names for each of the specific cache directories.
 * @type Array
 */
var cacheDirNames = {
  'REPOSITORY_CACHE': 'repository',
  'COMMITISH_CACHE': 'commitish',
  'DEPLOY_KEY_CACHE': 'deploy_key'
};

/**
 * Stores the original cache environment variable paths.
 * @type Object
 */
var cacheEnv = {};

/**
 * Creates and initializes fixture caches for testing.
 * @param {function} done Callback to execute once caches have been initialized.
 */
function create(done) {
  cachePaths.forEach(function (name) {
    cacheEnv[name] = process.env[name] || null;
    process.env[name] = [
      applicationRoot,
      'test/fixtures/cache',
      cacheDirNames[name]
    ].join('/');
  });
  require('../../lib/cache').initialize(done);
}

/**
 * Empties and resets the testing caches.
 * @param {function} done Called when the caches have been reset.
 */
function reset(done) {
  destroy(function (err) {
    if (err) { return done(err); }
    create(done);
  });
}

/**
 * Removes fixture caches.
 * @param {function} done Callback to execute once the caches have been removed.
 */
function destroy(done) {
  async.map(cachePaths, function (name, cb) {
    childProcess.exec('rm -rf ' + process.env[name], function (err) {
      process.env[name] = cacheEnv[name];
      cb(err);
    });
  }, done);
}
