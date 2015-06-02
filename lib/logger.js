'use strict';

var bunyan = require('bunyan');
var bunyanFormat = require('bunyan-format');

/**
 * Bunyan logger for optimus.
 * @author Ryan Sandor Richards
 * @module optimus:logger
 */
var log = module.exports = bunyan.createLogger({
  name: 'optimus',
  streams: [
    { stream: process.stdout }
  ],
  serializers: bunyan.stdSerializers
});

log.level(process.env.LOG_LEVEL);
