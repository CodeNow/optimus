'use strict'

const EventEmitter = require('events').EventEmitter

/**
 * Mock express response object.
 * See: http://winder.ws/2014/01/20/unit-testing-express-dot-js-routes.html
 * @class
 * @author Ryan Sandor Richards
 */
module.exports = class MockResponse extends EventEmitter {
  /**
   * Mocks the `.json` method.
   * @param {object} object Object for the JSON response.
   */
  json (object) {
    this.emit('json', object)
  }

  /**
   * Mocks the `.send` method.
   */
  send (object) {
    this.emit('send', object)
  }
}
