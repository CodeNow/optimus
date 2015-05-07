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
    it('should expose a cachePath method', function(done) {
      expect(deployKey.cachePath).to.be.a.function();
      done();
    });

    it('should expose the sshKeyPath method', function(done) {
      expect(deployKey.sshKeyPath).to.be.a.function();
      done();
    });

    it('should expose the fetch method', function(done) {
      expect(deployKey.fetch).to.be.a.function();
      done();
    });

    it('should expose the exec method', function(done) {
      expect(deployKey.exec).to.be.a.function();
      done();
    });
  }); // end 'interface'

  describe('cachePath', function() {
    it('should process environment to determine the cache path', function (done) {
      var keyPath = 'foo/bar/baz';
      var cachePath = process.env.DEPLOY_KEY_CACHE + '/foo.bar.baz';
      expect(deployKey.cachePath(keyPath)).to.equal(cachePath);
      done();
    });

    it('should strip leading slashes from the keypath', function(done) {
      var keyPath = '/gum/gum/bullet';
      var cachePath = process.env.DEPLOY_KEY_CACHE + '/gum.gum.bullet';
      expect(deployKey.cachePath(keyPath)).to.equal(cachePath);
      done();
    });
  });

  describe('sshKeyPath', function() {
    it('should correctly resolve a path to the ssh key', function(done) {
      var keyPath = '/go/go/gadget';
      var sshKeyPath = process.env.DEPLOY_KEY_CACHE + '/go.go.gadget/ssh-key';
      expect(deployKey.sshKeyPath(keyPath)).to.equal(sshKeyPath);
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
      var fullKeypath = deployKey.sshKeyPath(keyPath);
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

    it('should touch the cache directory when skipping the fetch', function(done) {
      fs.existsSync.returns(true);
      var keyPath = 'wat/wat';
      deployKey.fetch(keyPath, function () {
        expect(cache.touch.calledWith(deployKey.cachePath(keyPath)))
          .to.be.true();
        done();
      });
    });
  }); // end 'fetch'

  describe('exec', function() {
    it('should execute a command with the given key', function(done) {
      var keyPath = 'some/key/path';
      var command = 'rm -f /tmp/some/file';
      var expected = 'ssh-agent sh -c \'' +
        'ssh-add ' + deployKey.sshKeyPath(keyPath) + ';' +
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
        'ssh-add ' + deployKey.sshKeyPath(keyPath) + ';' +
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
        'ssh-add ' + deployKey.sshKeyPath(key) + ';' +
        'who \\| finger\'';
      deployKey.exec(key, command, options, function() {
        expect(childProcess.exec.calledWith(expected, options)).to.be.true();
        done();
      });
    });
  }); // end 'exec'
}); // end 'deploy-key'
