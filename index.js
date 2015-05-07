'use strict';

require('loadenv')('optimus:env');
var ClusterManager = require('cluster-man');
var monitor = require('monitor-dog');
var debug = require('debug');
var info = debug('optimus:info');
var error = debug('optimus:error');
var app = require('./lib/app');
var cache = require('./lib/cache');

/**
 * User repository transformer.
 * @module optimus
 * @author Ryan Sandor Richards
 */

/**
 * Master process.
 */
function master() {
  info('Master process started.');
  monitor.histogram('status', 1);
}

/**
 * Worker process.
 */
function worker() {
  var server = app.listen(process.env.PORT, function (err) {
    if (err) {
      error('Application start error: ' + err.stack);
      return process.exit(1);
    }
    var host = server.address().address;
    var port = server.address().port;
    info('Server listening on port http://' + host + ':' + port);
  });
}

/**
 * Performs additional actions before exiting the master process.
 * @param {Error} [err] Optional error.
 * @param {function} done Called when we are done.
 */
function beforeExit(err, done) {
  info('Master process exiting: ' + err.stack);
  monitor.histogram('status', 0);
  done();
}

// Initialize the cache and start the cluster
cache.initialize(function (err) {
  if (err) {
    error('Could not initialize cache: ' + err.stack);
    return process.exit(1);
  }

  // Create and start the cluster
  var cluster = new ClusterManager({
    master: master,
    worker: worker,
    beforeExit: beforeExit
  });
  cluster.start();
});
