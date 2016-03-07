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
    log.error({ err: err }, err.message)
  }

  /**
   * Middleware for logging and responding with errors.
   */
  respond (err, req, res, next) {
    super.respond(err, req, res, next)
    this.log(err)
  }
}

/**
 * Error handling via error-cat.
 * @module optimus:error
 * @author Ryan Sandor Richards
 */
module.exports = new Error()
