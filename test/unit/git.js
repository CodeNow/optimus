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
var Git = require('../../lib/git');
var deployKey = require('../../lib/deploy-key');

describe('Git', function() {
  var key = '/some/deploy/key';
  var path = '/working/path';
  var git;

  beforeEach(function (done) {
    git = new Git(key, path);
    sinon.stub(deployKey, 'exec').yieldsAsync();
    sinon.spy(Git.log, 'trace');
    done();
  });

  afterEach(function (done) {
    deployKey.exec.restore();
    Git.log.trace.restore();
    done();
  });

  describe('interface', function() {
    it('should expose the Git class', function(done) {
      expect(Git).to.be.a.function();
      done();
    });
  }); // end 'interface'

  describe('constructor', function () {
    it('should call _setup', function(done) {
      var _setup = sinon.spy(Git.prototype, '_setup');
      new Git('a', 'b');
      expect(_setup.calledWith('a', 'b')).to.be.true();
      Git.prototype._setup.restore();
      done();
    });
  });

  describe('_setup', function() {
    it('should set the appropriate instance variables', function(done) {
      var key = 'dat/key';
      var path = '/dat/path';
      git._setup(key, path);
      expect(git.key).to.equal(key);
      expect(git.path).to.equal(path);
      done();
    });
  });

  describe('clone', function() {
    it('should perform `git clone` for the repository', function(done) {
      var repo = 'git@github.com:Org/Repo';
      git.clone(repo, function () {
        var command = 'git clone -q ' + repo + ' ' + path;
        expect(deployKey.exec.calledOnce).to.be.true();
        expect(deployKey.exec.calledWith(key, command)).to.be.true();
        done();
      });
    });

    it('should should use the specified path when supplied', function(done) {
      var repo = 'git@github.com:Org/Repo';
      var givenPath = '/woot/sauce/go/now';
      git.clone(repo, givenPath, function() {
        var command = 'git clone -q ' + repo + ' ' + givenPath;
        expect(deployKey.exec.calledOnce).to.be.true();
        expect(deployKey.exec.calledWith(key, command)).to.be.true();
        done();
      });
    });

    it('should log the clone at `trace`', function(done) {
      var repo = 'git@github.com:Michigan/Eucher';
      var path = '/gonna/cheat';
      git.clone(repo, path, function () {
        expect(Git.log.trace.calledWith(
          { repo: repo, path: path },
          'Git: cloning ' + repo
        )).to.be.true();
        done();
      });
    });
  });

  describe('getSHA', function() {
    it('should get the SHA for the HEAD commit of the repo', function(done) {
      git.getSHA(function () {
        var command = 'git rev-parse HEAD';
        var options = { cwd: path }
        expect(deployKey.exec.calledOnce).to.be.true();
        expect(deployKey.exec.calledWith(key, command, options)).to.be.true();
        done();
      });
    });

    it('should log rev-parse at `trace`', function(done) {
      git.getSHA(function() {
        expect(Git.log.trace.calledWith('Git: SHA from head')).to.be.true();
        done();
      });
    });
  });

  describe('fetchAll', function() {
    it('should fetch all information for a repository', function(done) {
      git.fetchAll(function () {
        var command = 'git fetch --all';
        var options = { cwd: path }
        expect(deployKey.exec.calledOnce).to.be.true();
        expect(deployKey.exec.calledWith(key, command, options)).to.be.true();
        done();
      });
    });

    it('should log the fetch at `trace`', function(done) {
      git.fetchAll(function () {
        expect(Git.log.trace.calledWith('Git: fetch all')).to.be.true();
        done();
      });
    });
  });

  describe('checkout', function() {
    it('should checkout given a commitish', function(done) {
      var commitish = 'usetheforce';
      git.checkout(commitish, function () {
        var command = 'git checkout -q ' + commitish;
        var options = { cwd: path }
        expect(deployKey.exec.calledOnce).to.be.true();
        expect(deployKey.exec.calledWith(key, command, options)).to.be.true();
        done();
      });
    });

    it('should log the checkout at `trace`', function(done) {
      var commitish = 'superduperss';
      git.checkout(commitish, function () {
        expect(Git.log.trace.calledWith(
          { commitish: commitish }, 'Git: checkout ' + commitish
        )).to.be.true();
        done();
      });
    });
  }); // end 'checkout'
});
