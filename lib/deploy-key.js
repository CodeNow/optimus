'use strict';

require('loadenv')('optimus:env');
var monitor = require('monitor-dog');
var AWS = require('aws-sdk');
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');
var debug = require('debug');

/**
 * Module for fetching, caching, and using runnable deploy keys.
 * @module optimus:deploy-key
 * @author Ryan Sandor Richards
 */
module.exports = {
  resolve: resolve,
  fetch: fetch,
  remove: remove,
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
 * Resolves a keyPath given by the user. All keypaths are assumed to be relative
 * and this method will automatically remove leading slashes.
 * @param {string} keyPath SSH Key path to resolve.
 * @return {string} Absolute path to the given ssh key.
 */
function resolve(keyPath) {
  return path.resolve(
    process.env.DEPLOY_KEY_PATH,
    (keyPath.charAt(0) == '/') ? keyPath.slice(1) : keyPath
  );
}

/**
 * Fetches runnable deploy keys from S3 and caches them on the local filesystem.
 * @param keyPath Path of the key to fetch and store.
 * @param {optimus:deploy-key~FetchCallback} cb Callback to execute after the
 *   deploy key has been fetched.
 */
function fetch(keyPath, cb) {
  var absolutePath = resolve(keyPath);
  if (fs.existsSync(absolutePath)) {
    return cb();
  }

  var s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  });

  s3.getObject({ Bucket: process.env.S3_DEPLOY_KEY_BUCKET, Key: keyPath })
    .createReadStream()
    .pipe(fs.createWriteStream(absolutePath))
    .on('error', cb)
    .on('end', cb);
}

/**
 * Removes a given key from the local filesystem.
 * @param {string} keyPath Relative path for the key to remove.
 * @param {function} cb Callback to execute after removing the key.
 */
function remove(keyPath, cb) {
  fs.unlink(resolve(keyPath), cb);
}

/**
 * Executes a command with an ssh-agent using the specified key.
 * @param {string} keyPath Relative path to the key.
 * @param {string} command Command to execute.
 * @param {function} cb Callback to execute after child process exits.
 */
function exec(keyPath, command, cb) {
  // Builds a command that looks like this:
  // ssh-agent sh -c 'ssh-add /key/path; <command>'
  var sshCommand = [
    'ssh-agent sh -c \'',
    'ssh-add ', resolve(keyPath), ';',
    command.replace(/(['\\&|;])/g, '\\$1'), '\''
  ].join('');

  log.exec(sshCommand);
  childProcess.exec(sshCommand, cb);
}
