'use strict'

const ErrorCat = require('error-cat')
const log = require('./logger')

/**
 * Custom error-cat implementation.
 * @class
 */
class Error extends ErrorCat {
  /**
   * Handles error logging.
   * @see ErrorCat~log
   */
  log (err) {
    log.error(err)
  }
}

/**
 * Error handling via error-cat.
 * @module optimus:error
 * @author Ryan Sandor Richards
 */
module.exports = new Error()
