'use strict'

const isFunction = require('101/is-function')
const debug = require('debug')
const deployKey = require('./deploy-key')
const log = require('./logger').child({ module: 'git' })

/**
 * Debug log for testing.
 * use `DEBUG=optimus-test* npm test`, or `DEBUG=optimus-test:git npm test`
 * @type {object}
 */
const gitDebug = debug('optimus-test:git')

/**
 * Git command helper scoped to a specific repository path with the given
 * repository key.
 * @class
 */
class Git {
  /**
   * Creates a new git command helper.
   * @param {string} key Path to the ssh deploy key for the repository.
   * @param {string} path Path to the repository directory on the local file
   *   system.
   */
  constructor (key, path) {
    this._setup(key, path)
  }

  /**
   * Sets up the git class for use given a key and repository path. Also allows
   * us to easily determine if Git instances are constructed correctly in
   * external module tests.
   * @param {string} key Key to use when performing operations.
   * @param {string} path Path of the repository.
   */
  _setup (key, path) {
    this.key = key
    this.path = path
  }

  /**
   * Wraps deployKey.exec commands and provides logging and the correct key.
   * @param {string} command Command to execute.
   * @param {object} [options] Options for exec.
   * @param {function} cb Callback to execute after the child process completes.
   */
  exec (command, options, cb) {
    gitDebug(command)
    deployKey.exec(this.key, command, options, cb)
  }

  /**
   * Clones the given repository.
   * @param {string} repo Repository to clone.
   * @param {string} [path] Path to clone into.
   * @param {function} cb Callback to execute after performing the clone.
   */
  clone (repo, path, cb) {
    if (isFunction(path)) {
      cb = path
      path = this.path
    }
    log.trace('Git: cloning ' + repo + ' to ' + path)
    this.exec(['git clone -q', repo, path].join(' '), cb)
  }

  /**
   * Gets the SHA for the current commit of the repository.
   * @param {function} cb Callback to execute with the sha results.
   */
  getSHA (cb) {
    log.trace('Git: SHA from head')
    this.exec('git rev-parse HEAD', { cwd: this.path }, cb)
  }

  /**
   * Executes a fetch --all on the repository.
   * @param {function} cb Callback to execute after the command finishes.
   */
  fetchAll (cb) {
    log.trace('Git: fetch all')
    this.exec('git fetch --all', { cwd: this.path }, cb)
  }

  /**
   * Checks out a specific commitish for the repository.
   * @param {string} commitish Commitish to checkout.
   * @param {function} cb Callback to execute after the command finishes.
   */
  checkout (commitish, cb) {
    log.trace('Git: checkout ' + commitish)
    this.exec([
      'git checkout -q',
      commitish
    ].join(' '), { cwd: this.path }, cb)
  }
}

/**
 * The bunyan child logger for this module.
 * @type {object}
 */
Git.log = log

/**
 * Git command helper methods.
 * @module optimus:git
 * @author Ryan Sandor Richards
 */
module.exports = Git
