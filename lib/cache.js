'use strict'

const cat = require('error-cat')
const CriticalError = require('error-cat/errors/critical-error')
const logger = require('./logger').child({ module: 'cache' })
const Promise = require('bluebird')
const Warning = require('error-cat/errors/warning')

const childProcess = Promise.promisifyAll(require('child_process'))

/**
 * Handles repository and key caching for optimus.
 * @class
 * @author Ryan Sandor Richards
 */
class Cache {
  /**
   * Creates a new optimus cache.
   */
  constructor () {
    this.purgeInterval = null
  }

  /**
   * @return {Array} Paths to the various caches used by optimus.
   */
  getCachePaths () {
    return [
      process.env.DEPLOY_KEY_CACHE,
      process.env.REPOSITORY_CACHE,
      process.env.COMMITISH_CACHE
    ]
  }

  /**
   * Initializes the file system caches.
   * @return {Promise} Resolves when all filesystem caches have been
   *   intiialized.
   */
  initialize () {
    const log = logger.child({ method: 'initialize' })
    log.info('Initializing caches')
    return Promise
      .all(this.getCachePaths().map((path) => {
        return childProcess.execFileAsync('mkdir', ['-p', path])
          .catch((err) => {
            log.fatal({ path: path }, 'Unable to initialize cache')
            throw new CriticalError('Unable to initialize cache', {
              path: path,
              original: err
            })
          })
      }))
      .then(this.setPurgeInterval.bind(this))
  }

  /**
   * Sets a purging interval to periodically purge old entries from the cache.
   */
  setPurgeInterval () {
    const log = logger.child({ method: 'setPurgeInterval' })
    if (this.purgeInterval) { return }
    var duration = process.env.CACHE_PURGE_INTERVAL
    this.purgeInterval = setInterval(this.purge.bind(this), duration)
    log.info(`Cache purge interval set with duration of ${duration}ms`)
  }

  /**
   * Clears periodic purging interval.
   */
  clearPurgeInterval () {
    if (!this.purgeInterval) { return }
    const log = logger.child({ method: 'clearPurgeInterval' })
    log.info('Clearing cache purge interval')
    clearInterval(this.purgeInterval)
    this.purgeInterval = null
  }

  /**
   * Updates the modified and accessed time for a path on the filesystem. This
   * method allows the cache to perform LRU purging for keys and repositories.
   * @param {string} path Path to the file to touch.
   * @return {Promise} Resolves when the path has been touched.
   */
  touch (path) {
    return childProcess.execFileAsync('touch', [path])
  }

  /**
   * Locks a path so that it is excluded from purging.
   * @param {string} path Path to lock.
   * @return {Promise} Resolves when the path has been locked.
   */
  lock (path) {
    return childProcess.execFileAsync('mkdir', ['-p', `${path}/.optimus_lock`])
  }

  /**
   * Unlocks a path so that it can be purged.
   * @param {string} path Path to unlock.
   * @return {Promise} Resolves when a path has been unlocked.
   */
  unlock (path) {
    return childProcess.execFileAsync('rmdir', [`${path}/.optimus_lock`])
  }

  /**
   * LRU purge for deploy keys and repositories on the file system cache. LRU is
   * based on the last modified time reported by the system.
   * @return {Promise} Resolves when the caches have been purged.
   */
  purge () {
    const log = logger.child({ method: 'purge' })
    return Promise
      .all(this.getCachePaths().map((path) => {
        // TODO Find a good way of handling this without having to use .exec
        const command = [
          // Find only direct children of the cache path
          'find ' + path + ' -mindepth 1 -maxdepth 1',
          // and only ones that do not contain a `.optimus.lock` file
          '\\( -type d \'!\' -exec test -e "{}/.optimus.lock" \'\' \\)',
          // and only ones that have not been accessed in the last 30 min
          '\\( -type d -amin +' + process.env.CACHE_PURGE_AGE + ' \\)',
          // Print the results and pass them through xargs to rm -rf
          '-print | xargs rm -rf'
        ].join(' ')

        return childProcess
          .execAsync(command)
          .catch((err) => {
            throw new Warning('Unable to purge cache', { path: path, err: err })
          })
      }))
      .catch((err) => {
        log.error({ err: err }, 'Unable purge cache')
        cat.report(err)
      })
  }
}

/**
 * Optimus filesystem caching module.
 * @module optimus
 */
module.exports = new Cache()
