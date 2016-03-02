'use strict'

var ApiClient = require('simple-api-client')

/**
 * Default instance of the client.
 * @type {OptimusClient}
 */
var instance

/**
 * Optimus API client.
 * @class
 * @author Ryan Sandor Richards
 */
module.exports = class OptimusClient extends ApiClient {
  /**
   * Static class method to access only the transform action.
   * @see OptimusClient.prototype.transform
   */
  static transform (opts, cb) {
    if (!instance) {
      instance = new OptimusClient()
    }
    return instance.transform(opts, cb)
  }

  /**
   * API Client for Optimus. Sets the default host to `process.env.OPTIMUS_HOST`.
   * @param {string} [host] Overrides the default host for the client.
   * @param {Number} [port] Overrides the default port for the client.
   */
  constructor (host, port) {
    super([
      host || process.env.OPTIMUS_HOST,
      port || process.env.OPTIMUS_PORT || 80
    ].join(':'))
  }

  /**
   * Executes a transformation with the given options.
   * @param {object} opts Options for the transform.
   * @param {string} opts.repo Github link to the repository to transform.
   * @param {string} opts.commitish The specific commitish to transform.
   * @param {string} opts.deployKey Deploy key for the repository.
   * @param {array} opts.rules Array of transformation rules.
   * @param {optimus:client~TransformCallback} cb Callback to execute after the
   *   transformation has been completed.
   */
  transform (opts, cb) {
    var queryKeys = ['repo', 'commitish', 'deployKey']
    return this.put({
      path: '?' + queryKeys.map(function (name) {
        return name + '=' + encodeURIComponent(opts[name])
      }).join('&'),
      body: opts.rules,
      json: true
    }, cb)
  }
}
