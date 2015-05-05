'use strict';

require('loadenv')('optimus:env');
var async = require('async');
var monitor = require('monitor-dog');
var childProcess = require('child_process');

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

  // repo = 'git@github.com:runnable/fs-transform'

  var parts = repo.match(/git@github\.com:([^\/]+)\/(.+)/);
  var org = parts[1];
  var repository = parts[2];
  var repoDir = [process.env.REPOSITORY_PATH, org, repository].join('/');

  // 1. Create directory for the repository
  function makeRepoDirectory(next) {
    childProcess.exec('mkdir -p ' + repoDir, next);
  }



}





/**
 * Called after a repository has been fetched.
 * @callback optimus:repository~FetchCallback
 * @param {Error} [err] Error, if one occurred during the repository fetch.
 * @param {string} path Absolute path to the repository on the file system.
 */
