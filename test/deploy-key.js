'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var Code = require('code');
var expect = Code.expect;
var sinon = require('sinon');

require('loadenv')('optimus:env');
var AWS = require('aws-sdk');
var fs = require('fs');
var deployKey = require('../lib/deploy-key');
var mockS3 = require('./fixtures/mock-s3');
var noop = require('101/noop');

describe('deploy-key', function() {
  var s3 = mockS3.s3;
  var getObject = mockS3.getObject;
  var stream = mockS3.stream;
  var writeStream = 'a write stream';

  beforeEach(function (done) {
    sinon.stub(fs, 'createWriteStream').returns(writeStream);
    sinon.stub(AWS, 'S3').returns(s3);
    sinon.spy(s3, 'getObject');
    sinon.spy(getObject, 'createReadStream');
    sinon.spy(stream, 'pipe');
    sinon.spy(stream, 'on');
    done();
  });

  afterEach(function (done) {
    fs.createWriteStream.restore();
    AWS.S3.restore();
    s3.getObject.restore();
    getObject.createReadStream.restore();
    stream.pipe.restore();
    stream.on.restore();
    done();
  });

  it('should expose a fetch method', function(done) {
    expect(deployKey.fetch).to.be.a.function();
    done();
  });

  it('should provide s3 with the correct credentials', function(done) {
    deployKey.fetch('/some/path');
    expect(AWS.S3.calledWith({
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    })).to.be.true();
    done();
  });

  it('should get the correct deploy key object', function(done) {
    var keyPath = '/this/is/a/key/path';
    deployKey.fetch(keyPath);
    expect(s3.getObject.calledWith({
      Bucket: process.env.S3_DEPLOY_KEY_BUCKET,
      Key: keyPath
    })).to.be.true();
    done();
  });

  it('should pipe the object to the correct deploy key path', function(done) {
    var keyPath = 'this/is/a/key/path';
    var fullKeypath = [process.env.DEPLOY_KEY_PATH, keyPath].join('/');
    deployKey.fetch(keyPath);
    expect(fs.createWriteStream.calledOnce).to.be.true();
    expect(fs.createWriteStream.calledWith(fullKeypath)).to.be.true();
    expect(stream.pipe.calledOnce).to.be.true();
    expect(stream.pipe.calledWith(writeStream)).to.be.true();
    done();
  });

  it('should pass errors to the callback', function(done) {
    deployKey.fetch('any/path', noop);
    expect(stream.on.calledWith('error', noop)).to.be.true();
    done();
  });

  it('should execute the callback when the fetch is complete', function(done) {
    deployKey.fetch('/any/path', noop);
    expect(stream.on.calledWith('end', noop)).to.be.true();
    done();
  });
});
