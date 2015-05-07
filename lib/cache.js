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
  touch: touch,
  lock: lock,
  unlock: unlock,
  usage: usage,
  purge: purge,
  purgeAll: purgeAll
};

/**
 * Paths to each of the caches.
 * @type {array}
 */
var cachePaths = [
  process.env.DEPLOY_KEY_CACHE,
  process.env.REPOSITORY_CACHE,
  process.env.COMMITISH_CACHE
];

/**
 * Initializes the file system caches.
 * @param {function} cb Callback to execute after the caches have been created.
 */
function initialize(initCallback) {
  async.map(cachePaths, function (path, cb) {
    childProcess.exec('mkdir -p ' + path, cb);
  }, initCallback);
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
 *
 * Important: This method uses the system command `du` to determine the disk
 * space usage for each of the cahces. As such it can take a little time to run
 * since du recursively applies files stats to all files in the cahce to perform
 * its calculations. Thus, this method should called infrequently.
 *
 * @example
 * // JSON Result for GET /cache...
 * {
 *   "total": 123488239,
 *   "caches": [
 *     [23003, "/cache/deploy_keys"],
 *     [20303404, "/cache/repositories"],
 *     [4905090, "/cache/commitish"]
 *   ]
 * }
 *
 * @param {object} req Request object.
 * @param {object} res Response object.
 */
function usage(req, res) {
  async.map(
    cachePaths,
    function query(path, cb) {
      childProcess.exec('du -d0 ' + path, function (err, result) {
        if (err) { return cb(err); }
        var parts = result.split('\t');
        cb(null, [parseInt(parts[0]), parts[1]]);
      });
    },
    function compile(err, caches) {
      if (err) {
        return res.boom.badImplementation(err.message);
      }
      var total = caches.map(function (result) {
        return result[0];
      }).reduce(function (sum, current) {
        return sum + current;
      }, 0);
      res.json({ total: total, caches: caches });
    }
  );
}

/**
 * LRU purge for deploy keys and repositories on the file system cache. LRU is
 * based on the last modified time reported by the system.
 * @param {object} req Request object.
 * @param {object} res Response object.
 */
function purge(req, res) {
  async.map(
    cachePaths,
    function purge(path, cb) {
      childProcess.exec([
        // Find only direct children of the cache path
        'find ' + path + ' -mindepth 1 -maxdepth 1',

        // and only ones that do not contain a `.optimus.lock` file
        '\\( -type d \'!\' -exec test -e "{}/.optimus.lock" \';\' \\)',

        // and only ones that have not been accessed in the last 30 min
        '\\( -type d -amin +30 \\)',

        // Print the results and pass them through xargs to rm -rf
        '-print | xargs rm -rf'
      ].join(' '), cb);
    },
    function respond(err) {
      if (err) {
        return res.boom.badImplementation(err.message);
      }
      res.send();
    }
  );
}

/**
 * Purges all files in each cache.
 * @param {object} req Request object.
 * @param {object} res Response object.
 */
function purgeAll(req, res) {
  var paths = cachePaths.map(function (path) {
    return path + '/*';
  }).join(' ');
  childProcess.exec('rm -rf ' + paths, function(err) {
    if (err) {
      return res.boom.badImplementation(err.message);
    }
    res.send();
  });
}
