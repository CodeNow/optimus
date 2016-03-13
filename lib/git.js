'use strict'

const deployKey = require('./deploy-key')
const log = require('./logger').child({ module: 'git' })

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
   * @return {Promise} Resolves when the command has been executed.
   */
  exec (command, options, cb) {
    return deployKey.exec(this.key, command, options)
  }

  /**
   * Clones the given repository.
   * @param {string} repo Repository to clone.
   * @param {string} [path] Path to clone into.
   * @return {Promise} Resolves when the command has been executed.
   */
  clone (repo, path) {
    log.trace({ repo: repo, path: path }, 'git clone')
    return this.exec(`git clone -q ${repo} ${path}`)
  }

  /**
   * Gets the SHA for the current commit of the repository.
   * @return {Promise} Resolves when the command has been executed.
   */
  getSHA () {
    log.trace('git rev-parse HEAD')
    return this.exec('git rev-parse HEAD', { cwd: this.path })
  }

  /**
   * Executes a fetch --all on the repository.
   * @return {Promise} Resolves when the command has been executed.
   */
  fetchAll () {
    log.trace('git fetch --all')
    return this.exec('git fetch --all', { cwd: this.path })
  }

  /**
   * Checks out a specific commitish for the repository.
   * @param {string} commitish Commitish to checkout.
   * @return {Promise} Resolves when the command has been executed.
   */
  checkout (commitish) {
    log.trace({ commitish: commitish }, 'git checkout')
    return this.exec(`git checkout -q ${commitish}`, { cwd: this.path })
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
