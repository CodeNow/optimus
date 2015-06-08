'use strict';

require('loadenv')('optimus:env');

var ClusterManager = require('cluster-man');
var monitor = require('monitor-dog');
var app = require('./lib/app');
var cache = require('./lib/cache');
var logger = require('./lib/logger');

/**
 * User repository transformer.
 * @module optimus
 * @author Ryan Sandor Richards
 */

/**
 * Master process.
 */
function master() {
  cache.initialize(function (err) {
    if (err) {
      logger.error(err, 'Cache failed to initialize');
      return process.exit(1);
      monitor.histogram('status', 0);
    }
    logger.info('Master process started');
    monitor.histogram('status', 1);
    cache.setPurgeInterval();
  });
}

/**
 * Worker process.
 */
function worker() {
  var server = app.getInstance().listen(process.env.PORT, function (err) {
    if (err) {
      logger.error(err, 'Server failed to start');
      return process.exit(1);
    }
    var host = server.address().address;
    var port = server.address().port;
    logger.info('Server listening on port http://' + host + ':' + port);
  });
}

/**
 * Performs additional actions before exiting the master process.
 * @param {Error} [err] Optional error.
 * @param {function} done Called when we are done.
 */
function beforeExit(err, done) {
  logger.info('Master process exiting: ' + err.stack);
  monitor.histogram('status', 0);
  done();
}

// Create and start the cluster
var cluster = new ClusterManager({
  master: master,
  worker: worker,
  beforeExit: beforeExit
});
cluster.start();
