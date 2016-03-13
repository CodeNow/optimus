'use strict'

require('loadenv')('optimus:env')

const AWS = require('aws-sdk')
const cache = require('./cache')
const fs = require('fs')
const logger = require('./logger').child({ module: 'deploy-key' })
const Promise = require('bluebird')

const childProcess = Promise.promisifyAll(require('child_process'))

/**
 * Class for fetching, caching, and using runnable deploy keys.
 * @class
 * @author Ryan Sandor Richards
 */
class DeployKey {
  /**
   * Resolves a given s3 key path to a directory in the local file system cache.
   * Given keypaths are assumed to be relative and this method will automatically
   * remove leading slashes. Additionally, paths are flattened for the local cache
   * storage by replacing slashes with dots (see example).
   *
   * @example
   * // Returns '/cache/keys/foo.bar.baz'
   * deployKey.getCachePath('/foo/bar/baz')
   *
   * @param {string} keyPath SSH Key path to resolve.
   * @param {string} Path to the directory to contain the key in the local file
   *   system cache.
   */
  getCachePath (keyPath) {
    return [
      process.env.DEPLOY_KEY_CACHE,
      keyPath.replace(/^\//, '').replace(/\//g, '.')
    ].join('/')
  }

  /**
   * Fully resolves the file that stores the actual SSH key in the cache.
   *
   * @example
   * // Returns '/cache/keys/awesome.key/ssh-key'
   * deployKey.getSSHKeyPath('/awesome/key')
   *
   * @param {string} keyPath SSH Key path to resolve.
   * @return {string} Absolute path to the given ssh key.
   */
  getSSHKeyPath (keyPath) {
    return this.getCachePath(keyPath) + '/ssh-key'
  }

  /**
   * Executes a command with an ssh-agent using the specified key.
   * @param {string} keyPath Absolute path to the key.
   * @param {string} command Command to execute.
   * @param {object} [options] Options to send to `childprocess.exec`.
   * @return {Promise} Resolves once the command has been executed.
   */
  exec (keyPath, command, options) {
    // Builds a command that looks like this:
    // ssh-agent sh -c 'ssh-add /key/path <command>'
    const sshCommand = [
      'ssh-agent sh -c \'',
      'ssh-add ', keyPath, ' && ',
      command.replace(/(['\\&|])/g, '\\$1'), '\''
    ].join('')

    return childProcess.execAsync(sshCommand, options)
  }

  /**
   * Fetches runnable deploy keys from S3 and caches them on the local filesystem.
   * @param keyPath Path of the key to fetch and store.
   * @return {Promise} Resolves when the deploy key has been fetched.
   */
  fetch (keyPath) {
    const log = logger.child({ method: 'fetch' })
    return Promise.resolve()
      .then(() => {
        const cachePath = this.getCachePath(keyPath)
        const sshKeyPath = this.getSSHKeyPath(keyPath)

        log.info({ keyPath: keyPath }, 'Fetching key from S3')

        if (fs.existsSync(sshKeyPath)) {
          log.debug({ sshKeyPath: sshKeyPath }, 'SSH Key Cache Hit')
          // We actually need to touch the directory containing the key so we can
          // perfrom LRU caching the same way as with repositories.
          return cache.touch(cachePath)
        }

        return Promise.resolve()
          .then(function createCachePath () {
            if (fs.existsSync(cachePath)) { return }
            return childProcess.execFileAsync('mkdir', ['-p', cachePath])
          })
          .then(function downloadKey (cb) {
            const s3 = new AWS.S3({
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
            })

            const objectParams = {
              Bucket: process.env.S3_DEPLOY_KEY_BUCKET,
              Key: keyPath
            }

            return Promise
              .fromCallback((cb) => {
                log.debug({ params: objectParams }, 'Fetching deploy key')
                s3.getObject(objectParams, cb)
              })
              .then((data) => {
                log.debug({ sshKeyPath: sshKeyPath }, 'Writing deploy key')
                return fs.writeFileAsync(sshKeyPath, data.Body)
              })
          })
          .then(function chmodKey () {
            return childProcess.execFileAsync('chmod', ['600', sshKeyPath])
          })
      })
      .then(() => { return sshKeyPath })
  }
}

/**
 * Deploy keys module.
 * @module optimus:deploy-key
 */
module.exports = new DeployKey()
