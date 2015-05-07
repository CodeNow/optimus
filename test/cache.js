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
var cache = require('../lib/cache');
var MockResponse = require('./fixtures/mock-response');

describe('cache', function() {
  var response = new MockResponse();

  beforeEach(function (done) {
    sinon.stub(childProcess, 'exec').yieldsAsync();
    done();
  });

  afterEach(function (done) {
    childProcess.exec.restore();
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

    it('should expose the `purgeAll` method', function(done) {
      expect(cache.purgeAll).to.be.a.function();
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
  }); // end 'initialize'

  describe('touch', function() {
    it('should execute a touch on the given path', function(done) {
      cache.touch('/foo/bar', function (err) {
        if (err) { return done(err); }
        expect(childProcess.exec.calledWith('touch /foo/bar')).to.be.true();
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
  }); // end 'unlock'

  describe('usage', function() {
    it('should collect, tally, and report cache disk usage', function(done) {
      var deployKeyUsage = '100\t' + process.env.DEPLOY_KEY_CACHE;
      var repoUsage = '200\t' + process.env.REPOSITORY_CACHE;
      var commitishUsage = '300\t' + process.env.COMMITISH_CACHE;
      childProcess.exec
        .onFirstCall().yieldsAsync(null, deployKeyUsage)
        .onSecondCall().yieldsAsync(null, repoUsage)
        .onThirdCall().yieldsAsync(null, commitishUsage);
      response.once('json', function (data) {
        expect(data.total).to.equal(600);
        expect(data.caches).to.be.an.array();
        expect(data.caches).to.deep.include([
          [100, process.env.DEPLOY_KEY_CACHE],
          [200, process.env.REPOSITORY_CACHE],
          [300, process.env.COMMITISH_CACHE]
        ]);
        done();
      });
      cache.usage({}, response);
    });

    it('should report a 500 if an error occurs', function(done) {
      var message ='Something wicked, this way comes.';
      childProcess.exec.yieldsAsync(new Error(message));
      response.boom.once('badImplementation', function (msg) {
        expect(msg).to.equal(message);
        done();
      });
      cache.usage({}, response);
    });
  }); // end 'usage'

  describe('purge', function() {
    it('should purge cache directories', function(done) {
      var command = 'find $PATH -mindepth 1 -maxdepth 1 ' +
        '\\( -type d \'!\' -exec test -e "{}/.optimus.lock" \';\' \\) ' +
        '\\( -type d -amin +30 \\) ' +
        '-print | xargs rm -rf';
      response.once('send', function () {
        var cmd1 = command.replace('$PATH', process.env.DEPLOY_KEY_CACHE);
        expect(childProcess.exec.calledWith(cmd1)).to.be.true();
        var cmd2 = command.replace('$PATH', process.env.REPOSITORY_CACHE);
        expect(childProcess.exec.calledWith(cmd2)).to.be.true();
        var cmd3 = command.replace('$PATH', process.env.COMMITISH_CACHE);
        expect(childProcess.exec.calledWith(cmd3)).to.be.true();
        done();
      });
      cache.purge({}, response);
    });

    it('should report a 500 if an error occurs', function(done) {
      var error = new Error('Party on Wayne.')
      childProcess.exec.yieldsAsync(error);
      response.boom.once('badImplementation', function (err) {
        expect(err).to.equal(error);
        done();
      });
      cache.purge({}, response);
    });
  }); // end 'purge'

  describe('purgeAll', function() {
    it('should purge cache directories', function(done) {
      var command = 'find $PATH -mindepth 1 -maxdepth 1 ' +
        '\\( -type d \'!\' -exec test -e "{}/.optimus.lock" \';\' \\) ' +
        '-print | xargs rm -rf';
      response.once('send', function () {
        var cmd1 = command.replace('$PATH', process.env.DEPLOY_KEY_CACHE);
        expect(childProcess.exec.calledWith(cmd1)).to.be.true();
        var cmd2 = command.replace('$PATH', process.env.REPOSITORY_CACHE);
        expect(childProcess.exec.calledWith(cmd2)).to.be.true();
        var cmd3 = command.replace('$PATH', process.env.COMMITISH_CACHE);
        expect(childProcess.exec.calledWith(cmd3)).to.be.true();
        done();
      });
      cache.purgeAll({}, response);
    });

    it('should report a 500 if an error occurs', function(done) {
      var error = new Error('Party on Garth.')
      childProcess.exec.yieldsAsync(error);
      response.boom.once('badImplementation', function (err) {
        expect(err).to.equal(error);
        done();
      });
      cache.purgeAll({}, response);
    });
  }); // end 'purgeAll'
}); // end 'cache'
