'use strict';

var streamMock = {
  pipe: function () {
    return this;
  },
  on: function () {
    return this;
  }
};

var getObjectMock = {
  createReadStream: function () {
    return streamMock;
  }
};

var s3Mock = {
  getObject: function () {
    return getObjectMock;
  }
};

/**
 * Mocks AWS S3 Class' getObject stream.
 * @class
 * @module optimus:test
 */
module.exports = {
  s3: s3Mock,
  getObject: getObjectMock,
  stream: streamMock
};
