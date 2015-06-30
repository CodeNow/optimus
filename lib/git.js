'use strict';

var isFunction = require('101/is-function');
var debug = require('debug');
var childProcess = require('child_process');
var deployKey = require('./deploy-key');
var log = require('./logger').child({ module: 'git' });

/**
 * Git command helper methods.
 * @module optimus:git
 * @author Ryan Sandor Richards
 */
module.exports = Git;

/**
 * Debug log for testing.
 * use `DEBUG=optimus-test* npm test`, or `DEBUG=optimus-test:git npm test`
 * @type {object}
 */
var gitDebug = debug('optimus-test:git');

/**
 * Creates a new git command helper scoped to a specific repository path with
 * the given repository key.
 * @class
 * @param {string} key Path to the ssh deploy key for the repository.
 * @param {string} path Path to the repository directory on the local file
 *   system.
 */
function Git(key, path) {
  this._setup(key, path);
}

/**
 * The bunyan child logger for this module (child loggers sound illegal, btw).
 * @type {object}
 */
Git.log = log;

/**
 * Sets up the git class for use given a key and repository path. Also allows
 * us to easily determine if Git instances are constructed correctly in external
 * module tests.
 * @param {string} key Key to use when performing operations.
 * @param {string} path Path of the repository.
 */
Git.prototype._setup = function (key, path) {
  this.key = key;
  this.path = path;
};

/**
 * Wraps deployKey.exec commands and provides logging and the correct key.
 * @param {string} command Command to execute.
 * @param {object} [options] Options for exec.
 * @param {function} cb Callback to execute after the child process completes.
 */
Git.prototype.exec = function (command, options, cb) {
  gitDebug(command);
  deployKey.exec(this.key, command, options, cb);
};

/**
 * Clones the given repository.
 * @param {string} repo Repository to clone.
 * @param {string} [path] Path to clone into.
 * @param {function} cb Callback to execute after performing the clone.
 */
Git.prototype.clone = function (repo, path, cb) {
  if (isFunction(path)) {
    cb = path;
    path = this.path;
  }
  log.trace({
    repo: repo,
    path: path
  }, 'Git: cloning ' + repo);
  this.exec(['git clone -q', repo, path].join(' '), cb);
};

/**
 * Gets the SHA for the current commit of the repository.
 * @param {function} cb Callback to execute with the sha results.
 */
Git.prototype.getSHA = function (cb) {
  log.trace('Git: SHA from head');
  this.exec('git rev-parse HEAD', { cwd: this.path }, cb);
};

/**
 * Executes a fetch --all on the repository.
 * @param {function} cb Callback to execute after the command finishes.
 */
Git.prototype.fetchAll = function (cb) {
  log.trace('Git: fetch all');
  this.exec('git fetch --all', { cwd: this.path }, cb);
};

/**
 * Checks out a specific commitish for the repository.
 * @param {string} commitish Commitish to checkout.
 * @param {function} cb Callback to execute after the command finishes.
 */
Git.prototype.checkout = function (commitish, cb) {
  log.trace({
    commitish: commitish
  }, 'Git: checkout ' + commitish);
  this.exec([
    'git checkout -q',
    commitish
  ].join(' '), { cwd: this.path }, cb);
};
