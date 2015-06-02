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
var deployKey = require('../../lib/deploy-key');
var noop = require('101/noop');
var childProcess = require('child_process');
var cache = require('../../lib/cache');
var errorCat = require('../../lib/error');

describe('deploy-key', function() {
  var s3 = {
    getObject: function() {}
  };

  beforeEach(function (done) {
    sinon.stub(fs, 'writeFile').yieldsAsync();
    sinon.stub(AWS, 'S3').returns(s3);
    sinon.stub(s3, 'getObject').yieldsAsync(null, { Body: 'foo' });
    sinon.stub(childProcess, 'exec').yieldsAsync();
    sinon.stub(fs, 'existsSync').returns(false);
    sinon.stub(cache, 'touch').yieldsAsync();
    sinon.spy(deployKey.log, 'info');
    sinon.spy(deployKey.log, 'debug');
    sinon.spy(deployKey.log, 'error');
    sinon.spy(deployKey.log, 'fatal');
    sinon.spy(errorCat, 'wrap');
    done();
  });

  afterEach(function (done) {
    fs.writeFile.restore();
    AWS.S3.restore();
    s3.getObject.restore();
    childProcess.exec.restore();
    fs.existsSync.restore();
    cache.touch.restore();
    deployKey.log.info.restore();
    deployKey.log.debug.restore();
    deployKey.log.error.restore();
    deployKey.log.fatal.restore();
    errorCat.wrap.restore();
    done();
  });

  describe('interface', function() {
    it('should expose a `getCachePath` method', function(done) {
      expect(deployKey.getCachePath).to.be.a.function();
      done();
    });

    it('should expose the getSSHKeyPath method', function(done) {
      expect(deployKey.getSSHKeyPath).to.be.a.function();
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

  describe('getCachePath', function() {
    it('should process environment to determine the cache path', function (done) {
      var keyPath = 'foo/bar/baz';
      var cachePath = process.env.DEPLOY_KEY_CACHE + '/foo.bar.baz';
      expect(deployKey.getCachePath(keyPath)).to.equal(cachePath);
      done();
    });

    it('should strip leading slashes from the keypath', function(done) {
      var keyPath = '/gum/gum/bullet';
      var cachePath = process.env.DEPLOY_KEY_CACHE + '/gum.gum.bullet';
      expect(deployKey.getCachePath(keyPath)).to.equal(cachePath);
      done();
    });
  });

  describe('sshKeyPath', function() {
    it('should correctly resolve a path to the ssh key', function(done) {
      var keyPath = '/go/go/gadget';
      var sshKeyPath = process.env.DEPLOY_KEY_CACHE + '/go.go.gadget/ssh-key';
      expect(deployKey.getSSHKeyPath(keyPath)).to.equal(sshKeyPath);
      done();
    });
  });

  describe('fetch', function() {
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
        expect(cache.touch.calledWith(deployKey.getCachePath(keyPath)))
          .to.be.true();
        done();
      });
    });

    it('should gracefully handle touch errors when skipping fetch', function(done) {
      var error = new Error('touch error');
      fs.existsSync.returns(true);
      cache.touch.yields(error);
      deployKey.fetch('key/path', function (err) {
        expect(err).to.equal(error);
        done();
      })
    });

    it('should create the cache directory for the key', function(done) {
      var key = '/yay/sauce';
      deployKey.fetch(key, function (err) {
        var command = 'mkdir -p ' + deployKey.getCachePath(key);
        expect(childProcess.exec.calledWith(command)).to.be.true();
        done();
      });
    });

    it('should not create the cache path if it already exists', function(done) {
      fs.existsSync.onSecondCall().returns(true);
      var key = '/level/1/master-key';
      deployKey.fetch(key, function (err) {
        var command = 'mkdir -p ' + deployKey.getCachePath(key);
        expect(childProcess.exec.calledWith(command)).to.be.false();
        done();
      });
    });

    it('should provide s3 with the correct credentials', function(done) {
      deployKey.fetch('/some/path', function (err) {
        if (err) { return done(err); }
        expect(AWS.S3.calledWith({
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
        })).to.be.true();
        done();
      });
    });

    it('should get the correct deploy key object', function(done) {
      var keyPath = '/this/is/a/key/path';
      deployKey.fetch(keyPath, function (err) {
        if (err) { return done(err); }
        expect(s3.getObject.calledWith({
          Bucket: process.env.S3_DEPLOY_KEY_BUCKET,
          Key: keyPath
        })).to.be.true();
        done();
      });
    });

    it('should log deploy key cache hits at `debug`', function(done) {
      var keyPath = '/wowza/plowza';
      var sshKeyPath = deployKey.getSSHKeyPath(keyPath);
      fs.existsSync.returns(true);
      deployKey.fetch(keyPath, function (err) {
        if (err) { return done(err); }
        expect(deployKey.log.debug.calledWith(
          'SSH Key Cache Hit: ' + sshKeyPath
        )).to.be.true();
        done();
      });
    });

    it('should yield a 500 Boom error if the cache create failed', function(done) {
      var error = new Error('wuut?');
      childProcess.exec.yieldsAsync(error);
      deployKey.fetch('a/b', function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(err.output.payload.statusCode).to.equal(500);
        expect(errorCat.wrap.calledWith(
          err, 500, 'deployKey.fetch.createCachePath'
        )).to.be.true();
        done();
      });
    });

    it('should yield 4XX errors from S3', function(done) {
      var error = new Error('This should be a 404');
      error.statusCode = 404;
      s3.getObject.yieldsAsync(error);
      deployKey.fetch('sup', function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(err.output.payload.statusCode).to.equal(404);
        expect(errorCat.wrap.calledWith(error, 404, 'deployKey.fetch.downloadKey'))
          .to.be.true();
        done();
      });
    });

    it('should yield 502 Boom error if S3 failed with a 5XX', function(done) {
      var error = new Error('This should be a 404');
      error.statusCode = 509;
      s3.getObject.yieldsAsync(error);
      deployKey.fetch('yo', function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(err.output.payload.statusCode).to.equal(502);
        expect(errorCat.wrap.calledWith(error, 502, 'deployKey.fetch.downloadKey'))
          .to.be.true();
        done();
      });
    });

    it('should yield a 500 Boom error if the key file write failed', function(done) {
      var error = new Error('Mi kno rite gud');
      var keyPath = 'knee/flaf';
      var sshKeyPath = deployKey.getSSHKeyPath(keyPath);
      fs.writeFile.yieldsAsync(error);
      deployKey.fetch(keyPath, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(err.output.payload.statusCode).to.equal(500);
        expect(errorCat.wrap.calledWith(error, 500, 'deployKey.fetch.downloadKey'))
          .to.be.true();
        expect(err.data.keyPath).to.equal(sshKeyPath);
        done();
      });
    });

    it('should yield a 500 Boom error if the file permissions could not be changed', function(done) {
      var error = new Error('chmod is taking a schnooze');
      var keyPath = 'wii/braf';
      var sshKeyPath = deployKey.getSSHKeyPath(keyPath);
      childProcess.exec.onSecondCall().yields(error);
      deployKey.fetch(keyPath, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(err.output.payload.statusCode).to.equal(500);
        expect(errorCat.wrap.calledWith(error, 500, 'deployKey.fetch.chmodKey'))
          .to.be.true();
        expect(err.data.keyPath).to.equal(sshKeyPath);
        done();
      });
    });

    it('should log a fetch at `info`', function(done) {
      var keyPath = '/plz/log/me/kthxbye';
      deployKey.fetch(keyPath, function (err) {
        if (err) { return done(err); }
        expect(deployKey.log.info.calledWith(
          'Fetching key from S3: ' + keyPath
        )).to.be.true();
        done();
      });
    });
  }); // end 'fetch'

  describe('exec', function() {
    it('should execute a command with the given key', function(done) {
      var keyPath = 'some/key/path';
      var command = 'rm -f /tmp/some/file';
      var expected = 'ssh-agent sh -c \'' +
        'ssh-add ' + keyPath + ' && ' +
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
        'ssh-add ' + keyPath + ' && ' +
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
        'ssh-add ' + key + ' && ' +
        'who \\| finger\'';
      deployKey.exec(key, command, options, function() {
        expect(childProcess.exec.calledWith(expected, options)).to.be.true();
        done();
      });
    });

    it('should yield a 500 Boom error when a command fails', function(done) {
      var error = new Error('ssh crunch wrapped command error (by taco bell)');
      childProcess.exec.yieldsAsync(error);
      var command = 'who | finger';
      var keyPath = 'run/for/the/border';
      var sshCommand = 'ssh-agent sh -c \'' +
        'ssh-add ' + keyPath + ' && ' +
        'who \\| finger\'';
      deployKey.exec(keyPath, command, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(errorCat.wrap.calledWith(error, 500, 'deployKey.exec')).to.be.true();
        expect(err.data.keyPath).to.equal(keyPath);
        expect(err.data.command).to.equal(command);
        expect(err.data.sshCommand).to.equal(sshCommand);
        done();
      });
    });
  }); // end 'exec'
}); // end 'deploy-key'
