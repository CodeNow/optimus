'use strict';

require('loadenv')('optimus:env');
var async = require('async');
var monitor = require('monitor-dog');
var childProcess = require('child_process');
var isEmpty = require('101/is-empty');
var fs = require('fs');
var Git = require('./git');
var cache = require('./cache');

/**
 * Fetches user repositories.
 * @module optimus:repository
 * @author Ryan Sandor Richards
 */
module.exports = {
  fetch: fetch,
  getRepoPath: getRepoPath,
  getCommitishPath: getCommitishPath
};

/**
 * Fetches cached copies or clones user repositories and places them on the
 * local filesystem.
 * @param {string} key Path to the deploy key to use for the repository.
 * @param {string} repo Address of the remote repository to fetch/clone.
 * @param {string} commitish Commit-ish to use for the repository.
 * @param {optimus:repository~FetchCallback} fetchCallback Callback to execute
 *   once the repository has been fetched.
 */
function fetch(key, repo, commitish, fetchCallback) {
  var repositoryPath = getRepoPath(repo);
  var commitishPath = getCommitishPath(repo, commitish);

  // TODO This should probably be a validation in transform.js PUT / route
  if (!repositoryPath) {
    return fetchCallback(new Error('Cannot parse given repository.'));
  }

  var repositoryExists = fs.existsSync(repositoryPath + '/.git');
  var commitishExists = fs.existsSync(commitishPath + '/.git');

  // If we already have a cached copy, bypass the fetch and setup steps below
  if (repositoryExists && commitishExists) {
    return async.series(
      [
        function touchRepo(cb) {
          cache.touch(repositoryPath, cb);
        },
        function touchCommitish(cb) {
          cache.touch(commitishPath, cb);
        },
        function lockCommitish(cb) {
          cache.lock(commitishPath, cb);
        }
      ],
      function (err) {
        if (err) { return fetchCallback(err); }
        fetchCallback(null, commitishPath)
      }
    );
  }

  var fetchAndCheckout;
  var git = new Git(key, commitishPath);

  async.series(
    [
      // a. Create local repository cache directory if none exists
      function createRepoDirectory(cb) {
        if (repositoryExists) {
          return cache.touch(repositoryPath, cb);
        }
        childProcess.exec('mkdir -p ' + repositoryPath, cb);
      },

      // b. Clone repository into cache
      function cloneRepository(cb) {
        if (repositoryExists) { return cb(); }
        git.clone(repo, repositoryPath, cb);
      },

      // c. Create the comittish directory
      function createCommitishDir(cb) {
        if (commitishExists) {
          return cache.touch(commitishPath, cb);
        }
        childProcess.exec([
          'cp -r',
          repositoryPath,
          commitishPath
        ].join(' '), cb);
      },

      // d. Lock the commitish directory
      function lock(cb) {
        cache.lock(commitishPath, cb);
      },

      // e. Determine if we need to perform the fetch and checkout
      function compareSHAs(cb) {
        git.getSHA(function (err, sha) {
          if (err) { return cb(err); }
          fetchAndCheckout = (!sha || isEmpty(sha)) ? true :
            (sha.trim() !== commitish);
          cb();
        });
      },

      // f. Fetch all on repository so it is fully up-to-date (if applicable)
      function fetchAll(cb) {
        if (!fetchAndCheckout) { return cb(); }
        git.fetchAll(cb);
      },

      // g. Checkout the specific commitish (if applicable)
      function checkout(cb) {
        if (!fetchAndCheckout) { return cb(); }
        git.checkout(commitish, cb);
      }
    ],

    // h. Return the working path!
    function (err) {
      if (err) { return fetchCallback(err); }
      fetchCallback(null, commitishPath);
    }
  );
}

/**
 * Called after a repository has been fetched.
 * @callback optimus:repository~FetchCallback
 * @param {Error} [err] Error, if one occurred during the repository fetch.
 * @param {string} path Path to a prepared work directory for the repository.
 */

/**
 * Determines the cache directory for a given repoistory.
 * @param {string} repo Github repository address.
 * @return {string} Path to the cached version of the repo.
 */
function getRepoPath(repo) {
  var names = getOrgAndRepoFromURL(repo);
  if (!names) { return null; }
  return [
    process.env.REPOSITORY_CACHE,
    names.org,
    names.repo
  ].join('/');
}

/**
 * Determines the cache directory for a given repo commitish.
 * @param {string} repo Github repository address.
 * @param {string} commitish Commitish for the repo.
 * @return {string} Path to the cached version of the repo commitish.
 */
function getCommitishPath(repo, commitish) {
  var names = getOrgAndRepoFromURL(repo);
  if (!names) { return null; }
  return [
    process.env.COMMITISH_CACHE,
    names.org,
    names.repo,
    commitish
  ].join('/');
}

/**
 * Determines the organization and repository names from a git url.
 * @param {string} gitUrl URL to a git repository.
 * @return {object} An object containing the `repo` and `org` as properties
 *   derived from the given git url.
 */
function getOrgAndRepoFromURL(gitUrl) {
  var parts = gitUrl.match(/git@github\.com:([^\/]+)\/(.+)/);
  if (!parts) {
    return null;
  }
  return {
    org: parts[1],
    repo: parts[2]
  };
}
