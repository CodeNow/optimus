'use strict';

require('loadenv')('optimus:env');
var async = require('async');
var monitor = require('monitor-dog');
var childProcess = require('child_process');
var isEmpty = require('101/is-empty');
var fs = require('fs');
var Git = require('./git');
var cache = require('./cache');
var debug = require('debug');

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

// This debug is useful for seeing exactly what is happening during testing.
// Simply include DEBUG=optimus:test* before your test command :)
var workflow = debug('optimus:test:repo');

// Holds a locks for repository and commitish directories that are in the
// process of being handled by child processes.
//
// Important: these are software level memory locks, which are very different
// than the file system locks used by the caching module to exclude directories
// from purging.
//
// Note: Since the locks are process-level this restricts optimus to a single
// process of execution (i.e. no clustering). We will need to replace these with
// external locks in the future (most likely using redis).
var locks = {};

/**
 * Attemps to obtain a lock on a given path. Will spin until the lock is freed.
 * @param {string} path Path for which to obtain a spin lock.
 * @param {function} cb Callback to execute once the lock has been obtained.
 */
function getLock(path, cb) {
  if (!locks[path]) {
    locks[path] = true;
    return cb();
  }
  var lockInterval = setInterval(function () {
    if (!locks[path]) {
      clearInterval(lockInterval);
      locks[path] = true;
      cb();
    }
  }, process.env.SPIN_LOCK_INTERVAL);
}

/**
 * Frees a lock on a given path.
 * @param {string} path Path for the spin lock to free.
 */
function freeLock(path) {
  delete locks[path];
}

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
  var repositoryExists = fs.existsSync(repositoryPath + '/.git');
  var commitishExists = fs.existsSync(commitishPath + '/.git');

  // If we already have a cached copy, bypass the fetch and setup steps below
  if (repositoryExists && commitishExists) {
    workflow('Repository @ Commitish Exists, touching and locking.');
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
        fetchCallback(null, commitishPath);
      }
    );
  }

  // Need to ensure we have the key
  if (!fs.existsSync(key)) {
    return fetchCallback(new Error('Could not find ssh key: ' + key));
  }

  var fetchAndCheckout;
  var git = new Git(key, commitishPath);

  async.series(
    [
      // Get a lock on the repository directory
      function getRepositoryLock(next) {
        workflow('Getting repository path lock');
        getLock(repositoryPath, next);
      },

      // Create local repository cache directory if none exists
      function createRepoDirectory(next) {
        workflow('Creating repository directory: ' + repositoryPath);
        if (repositoryExists) {
          return cache.touch(repositoryPath, next);
        }
        childProcess.exec('mkdir -p ' + repositoryPath, next);
      },

      // Clone repository into cache
      function cloneRepository(next) {
        workflow('Cloning repository: ' + repo);
        if (repositoryExists) { return next(); }
        git.clone(repo, repositoryPath, next);
      },

      // Get a lock on the commitish directory
      function getCommitishLock(next) {
        workflow('Getting commitish path lock');
        getLock(commitishPath, next);
      },

      // Create the comittish directory
      function createCommitishDir(next) {
        workflow('Creating commitish directory: ' + commitishPath);
        if (commitishExists) {
          return cache.touch(commitishPath, next);
        }
        childProcess.exec([
          'cp -r',
          repositoryPath,
          commitishPath
        ].join(' '), next);
      },

      // Free the lock on the repository path
      function freeRepositoryLock(next) {
        workflow('Freeing repository path lock');
        freeLock(repositoryPath);
        next();
      },

      // Cache lock the commitish directory
      function cacheLock(next) {
        workflow('Cache locking commitish directory: ' + commitishPath);
        cache.lock(commitishPath, next);
      },

      // Determine if we need to perform the fetch and checkout
      function compareSHAs(next) {
        workflow('Comparing SHAs');
        git.getSHA(function (err, sha) {
          if (err) { return next(err); }
          fetchAndCheckout = (!sha || isEmpty(sha)) ? true :
            (sha.trim() !== commitish);
          next();
        });
      },

      // Fetch all on repository so it is fully up-to-date (if applicable)
      function fetchAll(next) {
        workflow('Fetching all');
        if (!fetchAndCheckout) { return next(); }
        git.fetchAll(next);
      },

      // Checkout the specific commitish (if applicable)
      function checkout(next) {
        workflow('Checking out commitish');
        if (!fetchAndCheckout) { return next(); }
        git.checkout(commitish, next);
      },

      // Free the lock on the commitish path
      function freeCommitishLock(next) {
        workflow('Freeing commitish lock');
        freeLock(commitishPath);
        next();
      }
    ],

    // h. Return the working path!
    function (err) {
      workflow('Repository successfully fetched.');
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
  return process.env.REPOSITORY_CACHE + '/' +
    names.org + '.' + names.repo;
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
  return process.env.COMMITISH_CACHE + '/' +
    names.org + '.' + names.repo + '.' + commitish;
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
