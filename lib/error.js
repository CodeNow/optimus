'use strict';

var ErrorCat = require('error-cat');
var util = require('util');
var log = require('./logger');

function Error() {
  ErrorCat.apply(this, arguments);
}
util.inherits(Error, ErrorCat);

Error.prototype.log = function (err) {
  log.error(err);
};

/**
 * Error handling via error-cat.
 * @module optimus:error
 * @author Ryan Sandor Richards
 */
module.exports = new Error();
