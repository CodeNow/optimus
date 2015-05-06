'use strict';

var childProcess = require('child_process');
var deployKey = require('./deploy-key');
var isFunction = require('101/is-function');

/**
 * Git command helper methods.
 * @module optimus:git
 * @author Ryan Sandor Richards
 */
module.exports = Git;

/**
 * Creates a new git command helper scoped to a specific repository path with
 * the given repository key.
 * @class
 * @param {string} key Path to the ssh deploy key for the repository.
 * @param {string} path Path to the repository directory on the local file
 *   system.
 */
function Git(key, path) {
  this.key = key;
  this.path = path;
}

/**
 * Clones the given repository.
 * @param {string} repo Repository to clone.
 * @param {string} [path] Path to clone into.
 * @param {function} cb Callback to execute after performing the clone.
 */
Git.prototype.clone = function (repo, path, cb) {
  if (isFunction(path)) {
    cb = path;
    path = this.path
  }
  var command = ['git clone -q', repo, path].join(' ');
  deployKey.exec(this.key, command, cb);
};

/**
 * Gets the SHA for the current commit of the repository.
 * @param {function} cb Callback to execute with the sha results.
 */
Git.prototype.getSHA = function (cb) {
  deployKey.exec(this.key, 'git rev-parse HEAD', { cwd: this.path }, cb);
};

/**
 * Executes a fetch --all on the repository.
 * @param {function} cb Callback to execute after the command finishes.
 */
Git.prototype.fetchAll = function (cb) {
  deployKey.exec(this.key, 'git fetch --all', { cwd: this.path }, cb);
};

/**
 * Checks out a specific commitish for the repository.
 * @param {string} commitish Commitish to checkout.
 * @param {function} cb Callback to execute after the command finishes.
 */
Git.prototype.checkout = function (commitish, cb) {
  var command = [
    'git checkout -q',
    commitish
  ].join(' ');
  deployKey.exec(this.key, command, { cwd: this.path }, cb);
};
