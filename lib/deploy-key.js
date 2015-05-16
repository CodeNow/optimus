'use strict';

require('loadenv')('optimus:env');
var monitor = require('monitor-dog');
var AWS = require('aws-sdk');
var fs = require('fs');
var path = require('path');
var async = require('async');
var debug = require('debug');
var childProcess = require('child_process');
var isFunction = require('101/is-function');
var cache = require('./cache');

/**
 * Module for fetching, caching, and using runnable deploy keys.
 * @module optimus:deploy-key
 * @author Ryan Sandor Richards
 */
module.exports = {
  getCachePath: getCachePath,
  getSSHKeyPath: getSSHKeyPath,
  fetch: fetch,
  exec: exec
};

/**
 * Debug methods for the module.
 * @type {object}
 */
var log = {
  exec: debug('optimus:deploy-key:exec')
};

/**
 * Resolves a given s3 key path to a directory in the local file system cache.
 * Given keypaths are assumed to be relative and this method will automatically
 * remove leading slashes. Additionally, paths are flattened for the local cache
 * storage by replacing slashes with dots (see example).
 *
 * @example
 * // Returns '/cache/keys/foo.bar.baz'
 * deployKey.getCachePath('/foo/bar/baz');
 *
 * @param {string} keyPath SSH Key path to resolve.
 * @param {string} Path to the directory to contain the key in the local file
 *   system cache.
 */
function getCachePath(keyPath) {
  return [
    process.env.DEPLOY_KEY_CACHE,
    keyPath.replace(/^\//, '').replace(/\//g, '.')
  ].join('/');
}

/**
 * Fully resolves the file that stores the actual SSH key in the cache.
 *
 * @example
 * // Returns '/cache/keys/awesome.key/ssh-key'
 * deployKey.getSSHKeyPath('/awesome/key');
 *
 * @param {string} keyPath SSH Key path to resolve.
 * @return {string} Absolute path to the given ssh key.
 */
function getSSHKeyPath(keyPath) {
  return getCachePath(keyPath) + '/ssh-key';
}

/**
 * Fetches runnable deploy keys from S3 and caches them on the local filesystem.
 * @param keyPath Path of the key to fetch and store.
 * @param {optimus:deploy-key~FetchCallback} cb Callback to execute after the
 *   deploy key has been fetched.
 */
function fetch(keyPath, fetchCallback) {
  var cachePath = getCachePath(keyPath);
  var sshKeyPath = getSSHKeyPath(keyPath);

  if (fs.existsSync(sshKeyPath)) {
    // We actually need to touch the directory containing the key so we can
    // perfrom LRU caching the same way as with repositories.
    return cache.touch(cachePath, function (err) {
      if (err) { return fetchCallback(err); }
      fetchCallback(null, sshKeyPath);
    });
  }

  async.series(
    [
      function createCachePath(cb) {
        if (fs.existsSync(cachePath)) { return cb(); }
        childProcess.exec('mkdir -p ' + cachePath, cb);
      },

      function downloadKey(cb) {
        var s3 = new AWS.S3({
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
        });

        var object = {
          Bucket: process.env.S3_DEPLOY_KEY_BUCKET,
          Key: keyPath
        };

        s3.getObject(object, function (err, data) {
          if (err) { return cb(err); }
          fs.writeFile(sshKeyPath, data.Body, cb);
        });
      },

      function chmodKey(cb) {
        childProcess.exec('chmod 600 ' + sshKeyPath, cb);
      }
    ],
    function (err) {
      if (err) { return fetchCallback(err); }
      fetchCallback(null, sshKeyPath);
    }
  );
}

/**
 * Executes a command with an ssh-agent using the specified key.
 * @param {string} keyPath Absolute path to the key.
 * @param {string} command Command to execute.
 * @param {object} [options] Options to send to `childprocess.exec`.
 * @param {function} cb Callback to execute after child process exits.
 */
function exec(keyPath, command, options, cb) {


  // Builds a command that looks like this:
  // ssh-agent sh -c 'ssh-add /key/path; <command>'
  var sshCommand = [
    'ssh-agent sh -c \'',
    'ssh-add ', keyPath, ';',
    command.replace(/(['\\&|;])/g, '\\$1'), '\''
  ].join('');

  console.log(sshCommand);

  if (isFunction(options)) {
    cb = options;
    options = {};
  }

  log.exec(sshCommand);
  childProcess.exec(sshCommand, options, cb);
}
