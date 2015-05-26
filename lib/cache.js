'use strict';

var async = require('async');
var childProcess = require('child_process');

/**
 * Handles repository and key caching for optimus.
 * @module optimus:cache
 * @author Ryan Sandor Richards
 */
module.exports = {
  initialize: initialize,
  setPurgeInterval: setPurgeInterval,
  clearPurgeInterval: clearPurgeInterval,
  touch: touch,
  lock: lock,
  unlock: unlock,
  usage: usage,
  purge: purge,
  purgeAll: purgeAll
};

/**
 * Interval for purging.
 */
var purgeInterval = null;

/**
 * @return {array} An array of the cache directories.
 */
function getCaches() {
  return [
    process.env.DEPLOY_KEY_CACHE,
    process.env.REPOSITORY_CACHE,
    process.env.COMMITISH_CACHE
  ];
}

/**
 * Initializes the file system caches.
 * @param {function} cb Callback to execute after the caches have been created.
 */
function initialize(initCallback) {
  async.map(getCaches(), function (path, cb) {
    childProcess.exec('mkdir -p ' + path, cb);
  }, initCallback);
}

/**
 * Sets a purging interval to periodically purge old entries from the cache.
 */
function setPurgeInterval() {
  if (purgeInterval) { return; }
  purgeInterval = setInterval(function () {
    // Calling it this way to ensure we can test this
    // very open to other suggestions :)
    module.exports.purge();
  }, process.env.CACHE_PURGE_INTERVAL);
}

/**
 * Clears periodic purging interval.
 */
function clearPurgeInterval() {
  if (!purgeInterval) { return; }
  clearInterval(purgeInterval);
  purgeInterval = null;
}

/**
 * Updates the modified and accessed time for a path on the filesystem. This
 * method allows the cache to perform LRU purging for keys and repositories.
 * @param {string} path Path to the file to touch.
 * @param {function} [cb] Optional callback to execute after touching the file.
 */
function touch(path, cb) {
  childProcess.exec('touch ' + path, cb);
}

/**
 * Locks a path so that it is excluded from purging.
 * @param {string} path Path to lock.
 * @param {function} [cb] Optional callback to execute after applying the lock.
 */
function lock(path, cb) {
  childProcess.exec('mkdir -p ' + path + '/.optimus_lock', cb);
}

/**
 * Unlocks a path so that it can be purged.
 * @param {string} path Path to unlock.
 * @param {function} [cb] Optional callback to execute after removing the lock.
 */
function unlock(path, cb) {
  childProcess.exec('rmdir ' + path + '/.optimus_lock', cb);
}

/**
 * Determines the total number of bytes being used by the key, repository, and
 * commitish caches.
 * @param {function} cb Callback to execute after the number of bytes have been
 *   determined.
 */
function usage(cb) {
  async.map(
    getCaches(),
    function query(path, cb) {
      childProcess.exec('du -d0 ' + path, function (err, result) {
        if (err) { return cb(err); }
        var parts = result.split('\t');
        cb(null, parseInt(parts[0]));
      });
    },
    function compile(err, caches) {
      if (err) { return cb(err); }
      cb(null, caches.reduce(function (sum, current) {
        return sum + current;
      }, 0));
    }
  );
}

/**
 * LRU purge for deploy keys and repositories on the file system cache. LRU is
 * based on the last modified time reported by the system.
 * @param {function} cb Callback to execute after caches have been LRU purged.
 */
function purge(cb) {
  async.map(
    getCaches(),
    function execute(path, cb) {
      childProcess.exec([
        // Find only direct children of the cache path
        'find ' + path + ' -mindepth 1 -maxdepth 1',
        // and only ones that do not contain a `.optimus.lock` file
        '\\( -type d \'!\' -exec test -e "{}/.optimus.lock" \';\' \\)',
        // and only ones that have not been accessed in the last 30 min
        '\\( -type d -amin +' + process.env.CACHE_PURGE_AGE + ' \\)',
        // Print the results and pass them through xargs to rm -rf
        '-print | xargs rm -rf'
      ].join(' '), cb);
    },
    cb
  );
}

/**
 * Purges all unlocked files in each cache.
 * @param {object} req Request object.
 * @param {object} res Response object.
 */
function purgeAll(cb) {
  async.map(
    getCaches(),
    function execute(path, cb) {
      childProcess.exec([
        'find ' + path + ' -mindepth 1 -maxdepth 1',
        '\\( -type d \'!\' -exec test -e "{}/.optimus.lock" \';\' \\)',
        '-print | xargs rm -rf'
      ].join(' '), cb);
    },
    cb
  );
}
