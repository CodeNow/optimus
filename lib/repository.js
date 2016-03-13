'use strict'

require('loadenv')('optimus:env')

const BaseError = require('error-cat/errors/base-error')
const cache = require('./cache')
const fs = require('fs')
const Git = require('./git')
const isEmpty = require('101/is-empty')
const logger = require('./logger').child({ module: 'repository' })
const Promise = require('bluebird')

const childProcess = Promise.promisifyAll(require('child_process'))

/**
 * Fetches user repositories.
 * @class
 * @author Ryan Sandor Richards
 */
class Repository {
  /**
   * Determines the organization and repository names from a git url.
   * @param {string} gitUrl URL to a git repository.
   * @return {object} An object containing the `repo` and `org` as properties
   *   derived from the given git url.
   */
  getOrgAndRepoFromURL (gitUrl) {
    var parts = gitUrl.match(/git@github\.com:([^\/]+)\/(.+)/)
    if (!parts) {
      return null
    }
    return {
      org: parts[1].toLowerCase(),
      repo: parts[2].toLowerCase()
    }
  }

  /**
   * Determines the cache directory for a given repoistory.
   * @param {string} repo Github repository address.
   * @return {string} Path to the cached version of the repo.
   */
  getRepoPath (repo) {
    var names = this.getOrgAndRepoFromURL(repo)
    if (!names) { return null }
    return `${process.env.REPOSITORY_CACHE}/${names.org}.${names.repo}`
  }

  /**
   * Determines the cache directory for a given repo commitish.
   * @param {string} repo Github repository address.
   * @param {string} commitish Commitish for the repo.
   * @return {string} Path to the cached version of the repo commitish.
   */
  getCommitishPath (repo, commitish) {
    var names = this.getOrgAndRepoFromURL(repo)
    if (!names) { return null }
    return `${process.env.COMMITISH_CACHE}/${names.org}.${names.repo}.${commitish}`
  }

  /**
   * Fetches cached copies or clones user repositories and places them on the
   * local filesystem.
   * @param {string} key Path to the deploy key to use for the repository.
   * @param {string} repo Address of the remote repository to fetch/clone.
   * @param {string} commitish Commit-ish to use for the repository.
   * @return {Promise} Resolves when the repository has been fetched.
   */
  fetch (key, repo, commitish) {
    const log = logger.child({ method: 'fetch' })
    log.info({ repo: repo, commitish: commitish }, 'Fetching repository')

    return Promise.try(() => {
      const repositoryPath = this.getRepoPath(repo)
      const commitishPath = this.getCommitishPath(repo, commitish)
      const repositoryExists = fs.existsSync(repositoryPath + '/.git')
      const commitishExists = fs.existsSync(commitishPath)

      // Ensure we have the ssh key
      if (!fs.existsSync(key)) {
        throw new BaseError('Missing key', { key: key })
      }

      // If we already have a cached copy, bypass the fetch + setup
      if (repositoryExists && commitishExists) {
        log.debug({
          repo: repo,
          commitish: commitish,
          commitishPath: commitishPath
        }, 'Cache hit')
        return this.fetchFromCache(repositoryPath, commitishPath)
          .then(() => { return commitishPath })
      }

      return this.fetchFromRemote(key, repo, commitish, repositoryExists)
        .then(() => { return commitishPath })
    })
  }

  /**
   * Touches the repository and commitish paths in the cache, cache-locks the
   * commitish and yields to the given callback with the path to the commitish
   * cache directory.
   * @param {string} repositoryPath Path to the repository cache directory.
   * @param {string} commitishPath Path tot he commitish cache directory.
   * @return {Promise} Resolves when the repository has been fetched.
   */
  fetchFromCache (repositoryPath, commitishPath) {
    return cache.touch(repositoryPath)
      .then(cache.touch.bind(cache, commitishPath))
      .then(cache.lock.bind(cache, commitishPath))
  }

  /**
   * Fetches a repository at a given commitish remotely from github, caches
   * both, and cache-locks the commitish.
   * @param {string} key Path to the deploy key to use for the repository.
   * @param {string} repo Address of the remote repository to fetch/clone.
   * @param {string} commitish Commit-ish to use for the repository.
   * @param {boolean} repositoryExists Whether or not the repository exists in
   *   in cache.
   * @return {Promise} Resolves when the repository has been fetched.
   */
  fetchFromRemote (key, repo, commitish, repositoryExists) {
    return Promise.try(() => {
      const repositoryPath = this.getRepoPath(repo)
      const commitishPath = this.getCommitishPath(repo, commitish)
      const git = new Git(key, commitishPath)
      const log = logger.child({
        method: 'fetchFromRemote',
        repositoryPath: repositoryPath,
        commitishPath: commitishPath
      })

      log.debug('Fetching remote repository')
      return Promise.resolve()
        .then(function createRepoDirectory () {
          if (repositoryExists) {
            log.trace('Repository path exists')
            return cache.touch(repositoryPath)
          }
          log.trace('Repository path missing, cloning')
          return childProcess.execFileAsync('mkdir', ['-p', repositoryPath])
            .then(function cloneRepository () {
              return git.clone(repo, repositoryPath)
            })
        })
        .then(function lockRepoDirectory () {
          log.trace('Cache locking repository path')
          return cache.lock(repositoryPath)
        })
        .then(function createCommitishDir () {
          log.trace('Generating commitish path')
          return childProcess
            .execFileAsync('cp', ['-r', repositoryPath, commitishPath])
        })
        .then(function cacheLockCommitish () {
          log.trace('Cache locking the commitish path')
          return cache.lock(commitishPath)
        })
        .then(function compareSHAs () {
          return git.getSHA()
            .then((sha) => {
              const fetchAndCheckout =
                (!sha || isEmpty(sha)) || (sha.trim() !== commitish)
              log.trace({
                fetchAndCheckout: fetchAndCheckout
              }, 'Comparing SHAs')
              return fetchAndCheckout
            })
        })
        .then(function fetchAll (fetchAndCheckout) {
          if (fetchAndCheckout) {
            log.trace('Checking out specific commitish')
            return git.fetchAll()
              .then(() => { return git.checkout(commitish) })
          }
          log.trace('Not checking out specific commitish')
        })
        .then(function removeDotGit () {
          log.trace('Removing .git directory')
          return childProcess.execAsync(`rm -rf '${commitishPath}/.git'`)
        })
    })
  }
}

module.exports = new Repository()
