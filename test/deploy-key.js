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
var childProcess = require('child_process');
var cache = require('../lib/cache');

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
    sinon.stub(childProcess, 'exec').yieldsAsync();
    sinon.stub(fs, 'existsSync').returns(false);
    sinon.stub(fs, 'unlink').yieldsAsync();
    sinon.stub(cache, 'touch').yieldsAsync();
    done();
  });

  afterEach(function (done) {
    fs.createWriteStream.restore();
    AWS.S3.restore();
    s3.getObject.restore();
    getObject.createReadStream.restore();
    stream.pipe.restore();
    stream.on.restore();
    childProcess.exec.restore();
    fs.existsSync.restore();
    fs.unlink.restore();
    cache.touch.restore();
    done();
  });

  describe('interface', function() {
    it('should expose the resolve method', function(done) {
      expect(deployKey.resolve).to.be.a.function();
      done();
    });

    it('should expose the fetch method', function(done) {
      expect(deployKey.fetch).to.be.a.function();
      done();
    });

    it('should expose the remove method', function(done) {
      expect(deployKey.remove).to.be.a.function();
      done();
    });

    it('should expose the exec method', function(done) {
      expect(deployKey.exec).to.be.a.function();
      done();
    });
  }); // end 'interface'

  describe('resolve', function() {
    it('should use process environment to resolve key paths', function(done) {
      var path = 'some/key/path';
      var expected = process.env.DEPLOY_KEY_CACHE + '/' + path;
      expect(deployKey.resolve(path)).to.equal(expected);
      done();
    });

    it('should trim leading slashes from given path', function(done) {
      var path = '/this/is/patha';
      var expected = process.env.DEPLOY_KEY_CACHE +  path;
      expect(deployKey.resolve(path)).to.equal(expected);
      done();
    });
  });

  describe('fetch', function() {
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
      var fullKeypath = deployKey.resolve(keyPath);
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

    it('should skip fetching keys that are already in cache', function(done) {
      fs.existsSync.returns(true);
      deployKey.fetch('what/whut', function () {
        expect(AWS.S3.callCount).to.equal(0);
        done();
      });
    });

    it('should touch the key file when skipping the fetch', function(done) {
      fs.existsSync.returns(true);
      deployKey.fetch('wat/wat', function () {
        expect(cache.touch.calledOnce).to.be.true();
        done();
      });
    });
  }); // end 'fetch'

  describe('remove', function() {
    it('should use fs.unlink to remove the key', function(done) {
      var keyPath = '/example/path/to/key';
      var unlinkPath = deployKey.resolve(keyPath);
      deployKey.remove(keyPath, function() {
        expect(fs.unlink.calledOnce).to.be.true();
        expect(fs.unlink.calledWith(unlinkPath)).to.be.true();
        done();
      });
    });
  }); // end 'remove'

  describe('exec', function() {
    it('should execute a command with the given key', function(done) {
      var keyPath = 'some/key/path';
      var command = 'rm -f /tmp/some/file';
      var expected = 'ssh-agent sh -c \'' +
        'ssh-add ' + deployKey.resolve(keyPath) + ';' +
        command +  '\'';
      deployKey.exec(keyPath, command, function () {
        expect(childProcess.exec.calledWith(expected)).to.be.true();
        done();
      });
    });

    it('should escape special characters in the given command', function(done) {
      var keyPath = 'some/key/path';
      var command = 'cat ; & | \' / \\';
      var expected = 'ssh-agent sh -c \'' +
        'ssh-add ' + deployKey.resolve(keyPath) + ';' +
        'cat \\; \\& \\| \\\' / \\\\' +  '\'';
      deployKey.exec(keyPath, command, function () {
        expect(childProcess.exec.calledWith(expected)).to.be.true();
        done();
      });
    });

    it('should allow the passing of options', function(done) {
      var key = 'keezor/the/destroyinator';
      var command = 'who | finger';
      var options = { cwd: '/tmp/wutwut' };
      var expected = 'ssh-agent sh -c \'' +
        'ssh-add ' + deployKey.resolve(key) + ';' +
        'who \\| finger\'';
      deployKey.exec(key, command, options, function() {
        expect(childProcess.exec.calledWith(expected, options)).to.be.true();
        done();
      });
    });
  }); // end 'exec'
}); // end 'deploy-key'
