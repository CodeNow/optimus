'use strict';

require('loadenv')('optimus:env');
var ClusterManager = require('cluster-man');
var monitor = require('monitor-dog');
var app = require('./lib/app');

/**
 * User repository transformer.
 * @module optimus
 * @author Ryan Sandor Richards
 */

/**
 * Master process.
 */
function master() {
  monitor.histogram('status', 1);
}

/**
 * Worker process.
 */
function worker() {
  app.listen(process.env.PORT);
}

/**
 * Performs additional actions before exiting the master process.
 * @param {Error} [err] Optional error.
 * @param {function} done Called when we are done.
 */
function beforeExit(err, done) {
  monitor.histogram('status', 0);
  done();
}

// Start the cluster
new ClusterManager({
  master: master,
  worker: worker,
  beforeExit: beforeExit
}).start();
