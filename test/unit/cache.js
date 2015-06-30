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
var childProcess = require('child_process');
var cache = require('../../lib/cache');
var errorCat = require('../../lib/error');

describe('cache', function() {
  beforeEach(function (done) {
    sinon.stub(childProcess, 'exec').yieldsAsync();
    sinon.spy(cache.log, 'info');
    sinon.spy(cache.log, 'debug');
    sinon.spy(cache.log, 'error');
    sinon.spy(cache.log, 'fatal');
    sinon.spy(errorCat, 'wrap');
    done();
  });

  afterEach(function (done) {
    childProcess.exec.restore();
    cache.log.info.restore();
    cache.log.debug.restore();
    cache.log.error.restore();
    cache.log.fatal.restore();
    errorCat.wrap.restore();
    done();
  });

  describe('interface', function() {
    it('should expose the `initialize` method', function(done) {
      expect(cache.initialize).to.be.a.function();
      done();
    });

    it('should expose the `touch` method', function(done) {
      expect(cache.touch).to.be.a.function();
      done();
    });

    it('should expose the `lock` method', function(done) {
      expect(cache.lock).to.be.a.function();
      done();
    });

    it('should expose the `unlock` method', function(done) {
      expect(cache.unlock).to.be.a.function();
      done();
    });

    it('should expose the `usage` method', function(done) {
      expect(cache.usage).to.be.a.function();
      done();
    });

    it('should expose the `purge` method', function(done) {
      expect(cache.purge).to.be.a.function();
      done();
    });

    it('should expose the `setPurgeInterval` method', function(done) {
      expect(cache.setPurgeInterval).to.be.a.function();
      done();
    });

    it('should expose the `clearPurgeInterval` method', function(done) {
      expect(cache.clearPurgeInterval).to.be.a.function();
      done();
    });
  }); // end 'interface'

  describe('initialize', function() {
    it('should create each missing cache path', function(done) {
      cache.initialize(function (err) {
        if (err) { return done(err); }
        var cmd1 = 'mkdir -p ' + process.env.DEPLOY_KEY_CACHE;
        expect(childProcess.exec.calledWith(cmd1)).to.be.true();
        var cmd2 = 'mkdir -p ' + process.env.REPOSITORY_CACHE;
        expect(childProcess.exec.calledWith(cmd2)).to.be.true();
        var cmd3 = 'mkdir -p ' + process.env.COMMITISH_CACHE;
        expect(childProcess.exec.calledWith(cmd3)).to.be.true();
        done();
      });
    });

    it('should log cache initialization at `info`', function(done) {
      cache.initialize(function (err) {
        if (err) { return done(err); }
        expect(cache.log.info.calledWith('Initializing file system caches'))
          .to.be.true();
        done();
      });
    });

    it('should log failed cache initialization at `fatal`', function(done) {
      var error = new Error('Cache init failure');
      childProcess.exec.yieldsAsync(error);
      cache.initialize(function (err) {
        var msg = 'Unable to initialize cache: ' + process.env.DEPLOY_KEY_CACHE;
        expect(cache.log.fatal.calledOnce).to.be.true();
        done();
      });
    });

    it('should log each cache creatiion at `debug`', function(done) {
      cache.initialize(function (err) {
        if (err) { return done(err); }
        expect(cache.log.debug.callCount).to.equal(3);
        expect(cache.log.debug.calledWith(
          { path: process.env.DEPLOY_KEY_CACHE },
          'Cache initialized'
        )).to.be.true();
        expect(cache.log.debug.calledWith(
          { path: process.env.REPOSITORY_CACHE },
          'Cache initialized'
        )).to.be.true();
        expect(cache.log.debug.calledWith(
          { path: process.env.COMMITISH_CACHE },
          'Cache initialized'
        )).to.be.true();
        done();
      });
    });
  }); // end 'initialize'

  describe('touch', function() {
    it('should execute a touch on the given path', function(done) {
      cache.touch('/foo/bar', function (err) {
        if (err) { return done(err); }
        expect(childProcess.exec.calledWith('touch /foo/bar')).to.be.true();
        done();
      });
    });

    it('should yield a Boom 500 error on failure', function(done) {
      var error = new Error('Touch error');
      var path = '/bar/baz';
      childProcess.exec.yieldsAsync(error);
      cache.touch(path, function (err) {
        expect(err.isBoom).to.be.true();
        expect(errorCat.wrap.calledWith(error, 500, 'cache.touch'))
          .to.be.true();
        done();
      });
    });
  }); // end 'touch'

  describe('lock', function() {
    it('should create a lock directory in the given path', function(done) {
      cache.lock('/tmp/wow', function (err) {
        if (err) { return done(err); }
        expect(childProcess.exec.calledWith('mkdir -p /tmp/wow/.optimus_lock'))
          .to.be.true();
        done();
      });
    });

    it('should yield a Boom 500 error on failure', function(done) {
      var error = new Error('Lock error');
      var path = '/path/to/lock';
      childProcess.exec.yieldsAsync(error);
      cache.lock(path, function (err) {
        expect(err.isBoom).to.be.true();
        expect(errorCat.wrap.calledWith(error, 500, 'cache.lock')).to.be.true();
        done();
      });
    });
  }); // end 'lock'

  describe('unlock', function() {
    it('should remove the lock file from the given path', function(done) {
      cache.unlock('/tmp/how', function (err) {
        if (err) { return done(err); }
        expect(childProcess.exec.calledWith('rmdir /tmp/how/.optimus_lock'))
          .to.be.true();
        done();
      });
    });

    it('should yield a Boom 500 error on failure', function(done) {
      var error = new Error('Unlock error');
      var path = '/path/to/unlock';
      childProcess.exec.yieldsAsync(error);
      cache.unlock(path, function (err) {
        expect(err.isBoom).to.be.true();
        expect(errorCat.wrap.calledWith(error, 500, 'cache.unlock'))
          .to.be.true();
        done();
      });
    });
  }); // end 'unlock'

  describe('usage', function() {
    it('should collect and tally cache disk usage', function(done) {
      var deployKeyUsage = '100\t' + process.env.DEPLOY_KEY_CACHE;
      var repoUsage = '200\t' + process.env.REPOSITORY_CACHE;
      var commitishUsage = '300\t' + process.env.COMMITISH_CACHE;
      childProcess.exec
        .onFirstCall().yieldsAsync(null, deployKeyUsage)
        .onSecondCall().yieldsAsync(null, repoUsage)
        .onThirdCall().yieldsAsync(null, commitishUsage);
      cache.usage(function (err, bytes) {
        if (err) { return done(err); }
        expect(bytes).to.equal(600);
        done();
      });
    });

    it('should gracefully handle errors', function(done) {
      var error = new Error('Something wicked');
      childProcess.exec.yieldsAsync(error);
      cache.usage(function (err) {
        expect(err).to.equal(error);
        done();
      });
    });

    it('should log the usage call at `info`', function(done) {
      var deployKeyUsage = '100\t' + process.env.DEPLOY_KEY_CACHE;
      var repoUsage = '200\t' + process.env.REPOSITORY_CACHE;
      var commitishUsage = '300\t' + process.env.COMMITISH_CACHE;
      childProcess.exec
        .onFirstCall().yieldsAsync(null, deployKeyUsage)
        .onSecondCall().yieldsAsync(null, repoUsage)
        .onThirdCall().yieldsAsync(null, commitishUsage);
      cache.usage(function (err) {
        expect(cache.log.info.calledWith(
          'Calculating cache disk usage'
        )).to.be.true();
        done();
      });
    });

    it('should log disk usage query errors at `error`', function(done) {
      var error = new Error('This way comes');
      childProcess.exec.yieldsAsync(error);
      cache.usage(function (err) {
        expect(cache.log.error.calledWith(
          { err: error }, 'Unable to collect disk usage information'
        )).to.be.true();
        done();
      });
    });
  }); // end 'usage'

  describe('purge', function() {
    it('should purge cache directories', function(done) {
      var command = 'find $PATH -mindepth 1 -maxdepth 1 ' +
        '\\( -type d \'!\' -exec test -e "{}/.optimus.lock" \';\' \\) ' +
        '\\( -type d -amin +' + process.env.CACHE_PURGE_AGE + ' \\) ' +
        '-print | xargs rm -rf';
      cache.purge(function (err) {
        if (err) { return done(err); }
        var cmd1 = command.replace('$PATH', process.env.DEPLOY_KEY_CACHE);
        expect(childProcess.exec.calledWith(cmd1)).to.be.true();
        var cmd2 = command.replace('$PATH', process.env.REPOSITORY_CACHE);
        expect(childProcess.exec.calledWith(cmd2)).to.be.true();
        var cmd3 = command.replace('$PATH', process.env.COMMITISH_CACHE);
        expect(childProcess.exec.calledWith(cmd3)).to.be.true();
        done();
      });
    });

    it('should handle file system errors', function(done) {
      var error = new Error('Party on Wayne.');
      childProcess.exec.yieldsAsync(error);
      cache.purge(function (err) {
        expect(err).to.equal(error);
        done();
      });
    });

    it('should log purging at `info`', function(done) {
      cache.purge(function (err) {
        if (err) { return done(err); }
        expect(cache.log.info.calledWith('Purging caches')).to.be.true();
        done();
      });
    });

    it('should log purge errors at `error`', function(done) {
      var error = new Error('Party on Garth.');
      childProcess.exec.yieldsAsync(error);
      cache.purge(function (err) {
        expect(cache.log.error.calledWith({ err: error }, 'Purge failed'))
          .to.be.true();
        done();
      });
    });
  }); // end 'purge'

  describe('setPurgeInterval', function() {
    var clock;

    beforeEach(function (done) {
      clock = sinon.useFakeTimers();
      sinon.spy(cache, 'purge');
      done();
    })

    afterEach(function (done) {
      clock.restore();
      cache.clearPurgeInterval();
      cache.purge.restore();
      done();
    });

    it('should set the purge interval based on the environment', function(done) {
      cache.setPurgeInterval();
      clock.tick(process.env.CACHE_PURGE_INTERVAL);
      expect(cache.purge.calledOnce).to.be.true();
      done();
    });

    it('should not set an interval if one is already exists', function(done) {
      cache.setPurgeInterval();
      cache.setPurgeInterval();
      clock.tick(process.env.CACHE_PURGE_INTERVAL);
      expect(cache.purge.calledOnce).to.be.true();
      done();
    });
  }); // end 'setPurgeInterval'

  describe('clearPurgeInterval', function() {
    var clock;

    beforeEach(function (done) {
      clock = sinon.useFakeTimers();
      sinon.spy(cache, 'purge');
      cache.setPurgeInterval();
      done();
    })

    afterEach(function (done) {
      clock.restore();
      cache.purge.restore();
      done();
    });

    it('should clear the interval', function(done) {
      cache.clearPurgeInterval();
      clock.tick(process.env.CACHE_PURGE_INTERVAL);
      expect(cache.purge.callCount).to.equal(0);
      done();
    });

    it('should ignore multiple clears', function(done) {
      cache.clearPurgeInterval();
      cache.clearPurgeInterval();
      cache.clearPurgeInterval();
      clock.tick(process.env.CACHE_PURGE_INTERVAL);
      expect(cache.purge.callCount).to.equal(0);
      done();
    });
  }); // end 'clearPurgeInterval'
}); // end 'cache'
