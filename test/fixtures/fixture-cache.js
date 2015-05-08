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
  clear: clear,
  destroy: destroy
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
    cacheEnv[name] = process.env[name];
    process.env[name] = [
      applicationRoot,
      'test/fixtures',
      cacheEnv[name].replace(/^\//, '')
    ].join('/');
  });
  require('../../lib/cache').initialize(done);
}

/**
 * Wipes each of the caches.
 * @param {function} done Callback to execute once the caches have been cleared.
 */
function clear(donedone) {
  async.map(cachePaths, function (name, cb) {
    childProcess.exec('rm -rf ' + process.env[name] + '/*', cb);
  }, function (err) {
    if (err) { return done(err); }
    cachePaths.forEach(function (name) {
      process.env[name] = cacheEnv[name];
    });
    done();
  });
}

/**
 * Removes fixture caches.
 * @param {function} done Callback to execute once the caches have been removed.
 */
function destroy(done) {
  async.map(cachePaths, function (name, cb) {
    childProcess.exec('rm -rf ' + process.env[name], cb);
  }, done);
}
