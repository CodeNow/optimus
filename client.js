'use strict';

var util = require('util');
var ApiClient = require('simple-api-client');

/**
 * Optimus API client.
 * @module optimus:client
 * @author Ryan Sandor Richards
 */
module.exports = OptimusClient;

/**
 * API Client for Optimus. Sets the default host to `process.env.OPTIMUS_HOST`.
 * @class
 * @param {string} [host] Overrides the default host for the client.
 * @param {Number} [port] Overrides the default port for the client.
 */
function OptimusClient(host, port) {
  var clientHost = host || process.env.OPTIMUS_HOST;
  var clientPort = port || process.env.OPTIMUS_PORT || 80;
  ApiClient.call(this, [clientHost, clientPort].join(':'));
}
util.inherits(OptimusClient, ApiClient);

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
OptimusClient.prototype.transform = function (opts, cb) {
  var queryKeys = ['repo', 'commitish', 'deployKey'];
  return this.put({
    path: '?' + queryKeys.map(function (name) {
      return name + '=' + encodeURIComponent(opts[name]);
    }).join('&'),
    body: opts.rules,
    json: true
  }, cb);
}

/**
 * Callback that is executed with the results of a file system transformation.
 * @callback optimus:client~TransformCallback
 * @param {Error} [err] An error, if one occurred.
 * @param {object} response The response object from optimus.
 */

/**
 * Default instance of the client.
 * @type {OptimusClient}
 */
var instance = new OptimusClient();

/**
 * Static class method to access only the transform action.
 * @see OptimusClient.prototype.transform
 */
OptimusClient.transform = instance.transform.bind(instance);

