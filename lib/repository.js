'use strict';

require('loadenv')('optimus:env');
var monitor = require('monitor-dog');

/**
 * Fetches user repositories.
 * @module optimus:repository
 * @author Ryan Sandor Richards
 */
module.exports = { fetch: fetch };

/**
 * Fetches cached copies or clones user repositories and places them on the
 * local filesystem.
 * @param {string} repo Address of the remote repository to fetch/clone.
 * @param {string} commitish Commit-ish to use for the repository.
 * @param {optimus:repository~FetchCallback} Callback to execute once the
 *   repository has been fetched.
 */
function fetch(repo, commitish, cb) {
  // TODO Implement me...
  cb(new Error('fetchAndPrepare is not yet implemented'));
}

/**
 * Called after a repository has been fetched.
 * @callback optimus:repository~FetchCallback
 * @param {Error} [err] Error, if one occurred during the repository fetch.
 * @param {string} path Absolute path to the repository on the file system.
 */
