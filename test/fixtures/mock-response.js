'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 * Mock express response object.
 * See: http://winder.ws/2014/01/20/unit-testing-express-dot-js-routes.html
 * @class
 * @module optimus:test
 * @author Ryan Sandor Richards
 */
var MockResponse = module.exports = function () {
  this.boom = new Boom();
};
util.inherits(MockResponse, EventEmitter);

/**
 * Mocks the `.json` method.
 * @param {object} object Object for the JSON response.
 */
MockResponse.prototype.json = function (object) {
  this.emit('json', object);
};

/**
 * Mocks the `.send` method.
 */
MockResponse.prototype.send = function (object) {
  this.emit('send', object);
};

/**
 * Mocks express-boom.
 * @class
 */
var Boom = function() {};
util.inherits(Boom, EventEmitter);

/**
 * Mock of the `boom.badRequest` method.
 * @param {Error} err Error sent to the bad request.
 */
Boom.prototype.badRequest = function (err) {
  this.emit('badRequest', err);
};

/**
 * Mock of the `boom.badImplementation` method.
 * @param {Error} err Error sent to bad implementation.
 */
Boom.prototype.badImplementation = function (err) {
  this.emit('badImplementation', err);
};
