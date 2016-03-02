'use strict'

const async = require('async')
const childProcess = require('child_process')
const debug = require('debug')
const error = require('./error')
const log = require('./logger')

/**
 * Testing debug for caching. Use DEBUG=optimus-test*
 * @type {object}
 */
const cacheDebug = debug('optimus-test:cache')

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
  log: log
}

/**
 * Interval for purging.
 */
var purgeInterval = null

/**
 * @return {array} An array of the cache directories.
 */
function getCaches () {
  return [
    process.env.DEPLOY_KEY_CACHE,
    process.env.REPOSITORY_CACHE,
    process.env.COMMITISH_CACHE
  ]
}

/**
 * Initializes the file system caches.
 * @param {function} cb Callback to execute after the caches have been created.
 */
function initialize (initCallback) {
  log.info('Initializing file system caches')
  async.map(getCaches(), function (path, cb) {
    childProcess.exec('mkdir -p ' + path, function (err) {
      if (err) {
        log.fatal(err, 'Unable to initialize cache: ' + path)
      } else {
        log.debug('Cache initialized: ' + path)
      }
      cb(err)
    })
  }, initCallback)
}

/**
 * Sets a purging interval to periodically purge old entries from the cache.
 */
function setPurgeInterval () {
  if (purgeInterval) { return }
  var purgeIntervalDuration = process.env.CACHE_PURGE_INTERVAL
  purgeInterval = setInterval(function () {
    module.exports.purge()
  }, purgeIntervalDuration)
  log.info([
    'Cache purge interval set with duration of', purgeIntervalDuration, 'ms'
  ].join(' '))
}

/**
 * Clears periodic purging interval.
 */
function clearPurgeInterval () {
  if (!purgeInterval) { return }
  log.info('Clearing cache purge interval')
  clearInterval(purgeInterval)
  purgeInterval = null
}

/**
 * Updates the modified and accessed time for a path on the filesystem. This
 * method allows the cache to perform LRU purging for keys and repositories.
 * @param {string} path Path to the file to touch.
 * @param {function} [cb] Optional callback to execute after touching the file.
 */
function touch (path, cb) {
  var command = 'touch ' + path
  cacheDebug(command)
  childProcess.exec(command, function (err) {
    if (err) {
      err.data = { path: path }
      return cb(error.wrap(err, 500, 'cache.touch'))
    }
    cb()
  })
}

/**
 * Locks a path so that it is excluded from purging.
 * @param {string} path Path to lock.
 * @param {function} [cb] Optional callback to execute after applying the lock.
 */
function lock (path, cb) {
  cacheDebug('LOCK ' + path)

  // NOTE The -p option is required because it is possible for a directory to
  //      already have a lock when this is called (specifically in the case
  //      where we are using `cp -r` to setup initial commitish directories
  //      before we execute the fetch and checkout commands).
  var command = 'mkdir -p ' + path + '/.optimus_lock'

  childProcess.exec(command, function (err) {
    if (err) {
      err.data = { path: path }
      return cb(error.wrap(err, 500, 'cache.lock'))
    }
    cb()
  })
}

/**
 * Unlocks a path so that it can be purged.
 * @param {string} path Path to unlock.
 * @param {function} [cb] Optional callback to execute after removing the lock.
 */
function unlock (path, cb) {
  cacheDebug('UNLOCK ' + path)
  var command = 'rmdir ' + path + '/.optimus_lock'
  childProcess.exec(command, function (err) {
    if (err) {
      err.data = { path: path }
      return cb(error.wrap(err, 500, 'cache.unlock'))
    }
    cb(err)
  })
}

/**
 * Determines the total number of bytes being used by the key, repository, and
 * commitish caches.
 * @param {function} cb Callback to execute after the number of bytes have been
 *   determined.
 */
function usage (cb) {
  log.info('Calculating cache disk usage')
  async.map(
    getCaches(),
    function query (path, queryCallback) {
      childProcess.exec('du -d0 ' + path, function (err, result) {
        if (err) { return queryCallback(err) }
        var parts = result.split('\t')
        queryCallback(null, parseInt(parts[0]))
      })
    },
    function compile (err, caches) {
      if (err) {
        log.error(err, 'Unable to collect disk usage information')
        return cb(err)
      }
      cb(null, caches.reduce(function (sum, current) {
        return sum + current
      }, 0))
    }
  )
}

/**
 * LRU purge for deploy keys and repositories on the file system cache. LRU is
 * based on the last modified time reported by the system.
 * @param {function} cb Callback to execute after caches have been LRU purged.
 */
function purge (cb) {
  log.info('Purging caches')
  async.map(
    getCaches(),
    function execute (path, cb) {
      var purgeCommand = [
        // Find only direct children of the cache path
        'find ' + path + ' -mindepth 1 -maxdepth 1',
        // and only ones that do not contain a `.optimus.lock` file
        '\\( -type d \'!\' -exec test -e "{}/.optimus.lock" \'\' \\)',
        // and only ones that have not been accessed in the last 30 min
        '\\( -type d -amin +' + process.env.CACHE_PURGE_AGE + ' \\)',
        // Print the results and pass them through xargs to rm -rf
        '-print | xargs rm -rf'
      ].join(' ')
      childProcess.exec(purgeCommand, function (err) {
        if (err) {
          log.error(err, 'Purge failed')
        } else {
          log.debug('Cache purged: ' + path)
        }
        cb(err)
      })
    },
    cb
  )
}
