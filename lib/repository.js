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
// Simply include DEBUG=optimus-test* before your test command :)
var workflow = debug('optimus-test:repo');

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
  var commitishExists = fs.existsSync(commitishPath);

  // If we already have a cached copy, bypass the fetch and setup steps below
  if (repositoryExists && commitishExists) {
    workflow('Repository & Commitish Exists, bypassing remote fetch.');
    return fetchFromCache(repositoryPath, commitishPath, function (err) {
      if (err) { return fetchCallback(err); }
      fetchCallback(null, commitishPath);
    });
  }

  // Need to ensure we have the key before moving forward with the fetch
  if (!fs.existsSync(key)) {
    return fetchCallback(new Error('Could not find ssh key: ' + key));
  }

  async.series(
    [
      function getRepositorySpinLock(next) {
        workflow('Getting spin-lock for repository');
        getLock(repositoryPath, next);
      },

      function getCommitishSpinLock(next) {
        workflow('Getting spin-lock for commitish');
        getLock(commitishPath, next);
      },

      function checkCache(next) {
        repositoryExists = fs.existsSync(repositoryPath + '/.git');
        commitishExists = fs.existsSync(commitishPath);

        if (repositoryExists && commitishExists) {
          workflow('Repository @ Commitish Exists, bypassing remote fetch');
          return fetchFromCache(repositoryPath, commitishPath, next);
        }

        workflow('Fetching repository from remote server');
        fetchFromRemote(
          key,
          repo,
          commitish,
          repositoryExists,
          next
        );
      },

      function freeSpinLocks(next) {
        workflow('Freeing spin-locks');
        freeLock(repositoryPath);
        freeLock(commitishPath);
        next();
      }
    ],

    function finish(err) {
      if (err) {
        workflow('Error encountered: ' + err);
        return fetchCallback(err);
      }
      workflow('Repository successfully fetched');
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
 * Touches the repository and commitish paths in the cache, cache-locks the
 * commitish and yields to the given callback with the path to the commitish
 * cache directory.
 * @param {string} repositoryPath Path to the repository cache directory.
 * @param {string} commitishPath Path tot he commitish cache directory.
 * @param {function} fetchCallback Callback to execute after the cache entries
 *   have been updated and locked.
 */
function fetchFromCache(repositoryPath, commitishPath, fetchCallback) {
  async.series([
    function touchRepo(cb) {
      workflow('Touching repository directory');
      cache.touch(repositoryPath, cb);
    },

    function touchCommitish(cb) {
      workflow('Touching commitish directory');
      cache.touch(commitishPath, cb);
    },

    function cacheLockCommitish(next) {
      workflow('Cache-locking commitish directory');
      cache.lock(commitishPath, next);
    }
  ], fetchCallback);
}

/**
 * Fetches a repository at a given commitish remotely from github, caches
 * both, and cache-locks the commitish.
 * @param {string} key Path to the deploy key to use for the repository.
 * @param {string} repo Address of the remote repository to fetch/clone.
 * @param {string} commitish Commit-ish to use for the repository.
 * @param {boolean} repositoryExists Whether or not the repository exists in
 *   in cache.
 * @param {function} fetchCallback Callback to execute after the cache entries
 *   have been updated and locked.
 */
function fetchFromRemote(
  key,
  repo,
  commitish,
  repositoryExists,
  fetchCallback
) {
  var repositoryPath = getRepoPath(repo);
  var commitishPath = getCommitishPath(repo, commitish);
  var fetchAndCheckout;
  var git = new Git(key, commitishPath);

  async.series([
    // Create local repository cache directory if none exists
    function createRepoDirectory(next) {
      if (repositoryExists) {
        workflow('Touching repository cache path');
        return cache.touch(repositoryPath, next);
      }
      workflow('Creating repository directory: ' + repositoryPath);
      childProcess.exec('mkdir -p ' + repositoryPath, next);
    },

    // Ensure the repository directory doesn't get purged before we are through
    function lockRepoDirectory(next) {
      if (repositoryExists) {
        return cache.lock(repositoryPath, next);
      }
      next();
    },

    // Clone repository into cache (if none existed)
    function cloneRepository(next) {
      if (repositoryExists) { return next(); }
      workflow('Cloning repository to ' + repositoryPath);
      git.clone(repo, repositoryPath, next);
    },

    // Create the comittish directory
    function createCommitishDir(next) {
      workflow('Creating commitish directory: ' + commitishPath);
      childProcess.exec([
        'cp -r',
        repositoryPath,
        commitishPath
      ].join(' '), next);
    },

    // Remove the cache lock from the repository directory
    function unlockRepoDirectory(next) {
      if (repositoryExists) {
        return cache.unlock(repositoryPath, next);
      }
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
        if (!sha || isEmpty(sha)) {
          fetchAndCheckout = true;
        }
        else {
          fetchAndCheckout = (sha.trim() !== commitish);
        }
        next();
      });
    },

    // Fetch all on repository so it is fully up-to-date (if applicable)
    function fetchAll(next) {
      if (!fetchAndCheckout) { return next(); }
      workflow('Fetching all');
      git.fetchAll(next);
    },

    // Checkout the specific commitish (if applicable)
    function checkout(next) {
      if (!fetchAndCheckout) { return next(); }
      workflow('Checking out commitish');
      git.checkout(commitish, next);
    },

    // Remove the .git directory from the cached copy of the commitish
    function removeDotGit(next) {
      workflow('Removing `.git/` from the cached commitish directory');
      var removeCommand = 'rm -rf ' +  commitishPath + '/.git';
      childProcess.exec(removeCommand, next);
    },
  ], fetchCallback);
}

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
    org: parts[1].toLowerCase(),
    repo: parts[2].toLowerCase()
  };
}
