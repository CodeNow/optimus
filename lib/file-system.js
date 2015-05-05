'use strict';

var async = require('async');
var childProcess = require('child_process');

/**
 * Sets up the filesystem for optimus.
 * @module optimus:file-system
 */
module.exports = { setup: setup };

/**
 * Sets up the file system so that it is ready for use by optimus. Specifically
 * this method ensures that the deploy key and repository paths exist.
 * @param {optimus:file-system~SetupCallback} cb Callback to execute after the
 *   file system has been set up.
 */
function setup(cb) {
  var paths = [
    process.env.DEPLOY_KEY_PATH,
    process.env.REPOSITORY_PATH
  ];
  async.map(paths, function (path, pathCallback) {
    childProcess.exec('mkdir -p ' + path, pathCallback);
  }, cb);
}

/**
 * Called after the file system has been set up.
 * @callback optimus:file-system~SetupCallback
 * @param {Error} [err] Error, if one occurred during the repository fetch.
 */
