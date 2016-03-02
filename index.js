'use strict'

require('loadenv')('optimus:env')

var ClusterManager = require('cluster-man')
var monitor = require('monitor-dog')
var app = require('./lib/app')
var cache = require('./lib/cache')
var logger = require('./lib/logger')

/**
 * User repository transformer.
 * @module optimus
 * @author Ryan Sandor Richards
 */

// Create the cluster
var cluster = new ClusterManager({
  master: function master () {
    cache.initialize(function (err) {
      if (err) {
        logger.error(err, 'Cache failed to initialize')
        monitor.histogram('status', 0)
        return process.exit(1)
      }
      logger.info('Master process started')
      monitor.histogram('status', 1)
      cache.setPurgeInterval()
    })
  },

  worker: function worker () {
    var server = app.getInstance().listen(process.env.PORT, function (err) {
      if (err) {
        logger.error(err, 'Server failed to start')
        return process.exit(1)
      }
      var host = server.address().address
      var port = server.address().port
      logger.info('Server listening on port http://' + host + ':' + port)
    })
  },

  beforeExit: function beforeExit (err, done) {
    logger.info('Master process exiting: ' + err.stack)
    monitor.histogram('status', 0)
    done()
  }
})

// Start the cluster
cluster.start()
