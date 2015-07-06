'use strict';

var bunyan = require('bunyan');

/**
 * Bunyan logger for optimus.
 * @author Ryan Sandor Richards
 * @module optimus:logger
 */
var log = module.exports = bunyan.createLogger({
  name: 'optimus',
  streams: [
    {
      level: process.env.LOG_LEVEL,
      stream: process.stdout
    }
  ],
  serializers: bunyan.stdSerializers
});
