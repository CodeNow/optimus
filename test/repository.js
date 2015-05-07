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
var fs = require('fs');
var childProcess = require('child_process');
var monitor = require('monitor-dog');
var Git = require('../lib/git');
var repository = require('../lib/repository');
var cache = require('../lib/cache');

describe('repository', function() {
  describe('interface', function() {
    it('should expose the fetch method', function(done) {
      expect(repository.fetch).to.be.a.function();
      done();
    });

    it('should expose the getRepoPath method', function(done) {
      expect(repository.getRepoPath).to.be.a.function();
      done();
    });

    it('should expose the getCommitishPath method', function(done) {
      expect(repository.getCommitishPath).to.be.a.function();
      done();
    });
  }); // end 'interface'

  describe('getRepoPath', function() {
    it('should return a correct repository cache path', function(done) {
      var repo = 'git@github.com:runnable/fs-transform';
      var expectedPath = process.env.REPOSITORY_CACHE +
        '/runnable.fs-transform';
      expect(repository.getRepoPath(repo)).to.equal(expectedPath);
      done();
    });

    it('should return null if the given repo was malformed', function(done) {
      var malformed = 'hdfskbnskna000222zeldarules';
      expect(repository.getRepoPath(malformed)).to.be.null();
      done();
    });
  }); // end 'getRepoPath'

  describe('getCommitishPath', function() {
    it('should return a correct commitish cache path', function(done) {
      var repo = 'git@github.com:gannon/power';
      var commitish = 'triforce';
      var expectedPath = process.env.COMMITISH_CACHE +
        '/gannon.power.triforce';
      expect(repository.getCommitishPath(repo, commitish))
        .to.equal(expectedPath);
      done();
    });

    it('should return null if the given repo was malformed', function(done) {
      var malformed = 'superduperpooperscooper';
      expect(repository.getCommitishPath(malformed, 'anything')).to.be.null();
      done();
    });
  }); // end 'getCommitishPath'

  describe('fetch', function() {
    beforeEach(function (done) {
      sinon.stub(fs, 'existsSync').returns(false);
      sinon.stub(childProcess, 'exec').yieldsAsync();
      sinon.stub(Git.prototype, 'clone').yieldsAsync();
      sinon.stub(Git.prototype, 'getSHA').yieldsAsync(null, 'somesha');
      sinon.stub(Git.prototype, 'fetchAll').yieldsAsync();
      sinon.stub(Git.prototype, 'checkout').yieldsAsync();
      sinon.spy(Git.prototype, '_setup');
      sinon.stub(cache, 'lock').yieldsAsync();
      sinon.stub(cache, 'touch').yieldsAsync();
      done();
    });

    afterEach(function (done) {
      fs.existsSync.restore();
      childProcess.exec.restore();
      Git.prototype.clone.restore();
      Git.prototype.getSHA.restore();
      Git.prototype.fetchAll.restore();
      Git.prototype.checkout.restore();
      Git.prototype._setup.restore();
      cache.lock.restore();
      cache.touch.restore();
      done();
    });

    // TODO Possibly pulling this check out into PUT / route
    it('should give an error if the given repo was malformed', function(done) {
      var malformed = 'garlandlives';
      repository.fetch('some/key', malformed, '1234', function (err) {
        expect(err).to.not.be.null();
        expect(err.message).to.equal('Cannot parse given repository.');
        done();
      });
    });

    it('should check the existence of the repository directory', function(done) {
      var repo = 'git@github.com:example/sauce';
      var path = repository.getRepoPath(repo);
      repository.fetch('a/key', repo, '3455', function (err) {
        if (err) { return done(err); }
        expect(fs.existsSync.calledWith(path + '/.git')).to.be.true();
        done();
      });
    });

    it('should check the existence of the commitish directory', function(done) {
      var repo = 'git@github.com:totes/magoats';
      var commitish = 'c0mitti5h';
      var path = repository.getCommitishPath(repo, commitish);
      repository.fetch('a/key', repo, commitish, function (err) {
        if (err) { return done(err); }
        expect(fs.existsSync.calledWith(path + '/.git')).to.be.true();
        done();
      });
    });

    it('should bypass fetch if repo and commitish are cached', function(done) {
      fs.existsSync.returns(true);
      var repo = 'git@github.com:westeros/hodor';
      var commitish = 'hodoorrrrr';
      var expectedPath = repository.getCommitishPath(repo, commitish);
      repository.fetch('das/key', repo, commitish, function (err, path) {
        if (err) { return done(err); }
        expect(childProcess.exec.callCount).to.equal(0);
        expect(Git.prototype.clone.callCount).to.equal(0);
        expect(Git.prototype.getSHA.callCount).to.equal(0);
        expect(Git.prototype.fetchAll.callCount).to.equal(0);
        expect(Git.prototype.checkout.callCount).to.equal(0);
        expect(path).to.equal(expectedPath);
        done();
      });
    });

    it('should touch the repo and commitish directories when bypassing', function(done) {
      fs.existsSync.returns(true);
      var repo = 'git@github.com:westeros/cersei';
      var commitish = 'mybrotherishot';
      var repoPath = repository.getRepoPath(repo);
      var commitishPath = repository.getCommitishPath(repo, commitish);
      repository.fetch('dos/key', repo, commitish, function (err, path) {
        if (err) { return done(err); }
        expect(cache.touch.calledWith(repoPath)).to.be.true();
        expect(cache.touch.calledWith(commitishPath)).to.be.true();
        done();
      });
    });

    it('should lock the commitish directory when bypassing', function(done) {
      fs.existsSync.returns(true);
      var repo = 'git@github.com:westeros/catlyn';
      var commitish = 'imtotesundead';
      var commitishPath = repository.getCommitishPath(repo, commitish);
      repository.fetch('dos/equis', repo, commitish, function (err, path) {
        if (err) { return done(err); }
        expect(cache.lock.calledWith(commitishPath)).to.be.true();
        done();
      });
    });

    it('should report errors when bypassing', function(done) {
      var error = new Error('The dragon queen cometh');
      fs.existsSync.returns(true);
      cache.touch.yieldsAsync(error);
      var repo = 'git@github.com:westeros/tyrion';
      var commitish = 'ilikewineandbooks';
      var commitishPath = repository.getCommitishPath(repo, commitish);
      repository.fetch('dos/equis', repo, commitish, function (err, path) {
        expect(err).to.equal(error);
        done();
      });
    });

    it('should set the correct key and path for git', function(done) {
      var key = 'mah/keyzz';
      var repo = 'git@github.com:bowser/powser';
      var commitish = '1234';
      var commitishPath = repository.getCommitishPath(repo, commitish);
      repository.fetch(key, repo, '1234', function (err) {
        if (err) { return done(err); }
        expect(Git.prototype._setup.calledWith(key, commitishPath))
          .to.be.true();
        done();
      });
    });

    it('should create a repository cache directory', function(done) {
      var repo = 'git@github.com:talltales/paul';
      var command = 'mkdir -p ' + repository.getRepoPath(repo);
      repository.fetch('big/axe', repo, 'lumberjack', function (err) {
        if (err) { return done(err); }
        expect(childProcess.exec.calledWith(command)).to.be.true();
        done();
      });
    });

    it('should touch the repository cache directory if it already exists', function(done) {
      fs.existsSync.onFirstCall().returns(true);
      var repo = 'git@github.com:daredevil/hitlist';
      var repoPath = repository.getRepoPath(repo)
      var command = 'mkdir -p ' + repoPath;
      repository.fetch('blind/justice', repo, 'karate', function (err) {
        if (err) { return done(err); }
        expect(childProcess.exec.calledWith(command)).to.be.false();
        expect(cache.touch.calledWith(repoPath)).to.be.true();
        done();
      });
    });

    it('should clone the repository', function(done) {
      var repo = 'git@github.com:luigi/mansion';
      var repositoryPath = repository.getRepoPath(repo);
      repository.fetch('green/hat', repo, 'bigjumps', function(err) {
        if (err) { return done(err); }
        expect(Git.prototype.clone.calledWith(repo, repositoryPath))
          .to.be.true();
        done();
      });
    });

    it('should not clone the repository if it already exists', function(done) {
      fs.existsSync.onFirstCall().returns(true);
      var repo = 'git@github.com:toad/hut';
      var repositoryPath = repository.getRepoPath(repo);
      repository.fetch('mushroom/hat', repo, 'tinyjumps', function(err) {
        if (err) { return done(err); }
        expect(Git.prototype.clone.calledWith(repo, repositoryPath))
          .to.be.false();
        done();
      });
    });

    it('should create the commitish directory', function(done) {
      var repo = 'git@github.com:big/star';
      var commitish = 'radiocity';
      var repoPath = repository.getRepoPath(repo);
      var commitishPath = repository.getCommitishPath(repo, commitish);
      var command = 'cp -r ' + repoPath + ' ' + commitishPath;
      repository.fetch('key', repo, commitish, function (err) {
        if (err) { return done(err); }
        expect(childProcess.exec.calledWith(command)).to.be.true();
        done();
      });
    });

    it('should touch the commitish directory if it already exists', function(done) {
      fs.existsSync.onSecondCall().returns(true);
      var repo = 'git@github.com:nin/downwardspiral';
      var commitish = 'closer';
      var repoPath = repository.getRepoPath(repo);
      var commitishPath = repository.getCommitishPath(repo, commitish);
      var command = 'cp -r ' + repoPath + ' ' + commitishPath;
      repository.fetch('key', repo, commitish, function (err) {
        if (err) { return done(err); }
        expect(cache.touch.calledWith(commitishPath)).to.be.true();
        expect(childProcess.exec.calledWith(command)).to.be.false();
        done();
      });
    });

    it('should lock the commitish directory', function(done) {
      var repo = 'git@github.com:soundgarden/superunknown';
      var commitish = 'spoonman';
      var repoPath = repository.getRepoPath(repo);
      var commitishPath = repository.getCommitishPath(repo, commitish);
      repository.fetch('key', repo, commitish, function (err) {
        if (err) { return done(err); }
        expect(cache.lock.calledWith(commitishPath)).to.be.true();
        done();
      });
    });

    it('should compare the commitish to the cache git sha', function(done) {
      var repo = 'git@github.com:avengers/ultron';
      repository.fetch('kee', repo, 'tonystark', function (err) {
        if (err) { return done(err); }
        expect(Git.prototype.getSHA.calledOnce).to.be.true();
        done();
      });
    });

    it('should yield command errors when getting sha', function(done) {
      var repo = 'git@github.com:lego/technic';
      var error = new Error('Sup playa?');
      Git.prototype.getSHA.yields(error);
      repository.fetch('weeee', repo, 'helicopter', function (err) {
        expect(err).to.equal(error);
        done();
      });
    });

    it('should not compare if the returned sha is empty', function(done) {
      var repo = 'git@github.com:rsandor/solace';
      Git.prototype.getSHA.yields(null, '');
      repository.fetch('mahkey', repo, 'mudsrule', done);
    });

    it('should fetch all if the commitish does not match the sha', function(done) {
      var repo = 'git@github.com:nirvana/smells-like-teen-spirit';
      Git.prototype.getSHA.yields(null, '3456');
      repository.fetch('keezzz', repo, '1234', function (err) {
        if (err) { return done(err); }
        expect(Git.prototype.fetchAll.calledOnce).to.be.true();
        done();
      });
    });

    it('should not fetch all if the commitish matches the sha', function(done) {
      var repo = 'git@github.com:smooth/criminal';
      var commitish = 'abcdef';
      Git.prototype.getSHA.yields(null, commitish);
      repository.fetch('mj', repo, commitish, function (err) {
        if (err) { return done(err); }
        expect(Git.prototype.fetchAll.calledOnce).to.be.false();
        done();
      });
    });

    it('should checkout if the commitish does not match the sha', function(done) {
      var repo = 'git@github.com:rappers/snoop';
      var commitish = 'oranges';
      Git.prototype.getSHA.yields(null, 'apples');
      repository.fetch('ginandjuice', repo, commitish, function (err) {
        if (err) { return done(err); }
        expect(Git.prototype.checkout.calledWith(commitish)).to.be.true();
        done();
      });
    });

    it('should not checkout if the commitish matches the sha', function(done) {
      var repo = 'git@github.com:happybirthday/bryan';
      var commitish = 'woooo!';
      Git.prototype.getSHA.yields(null, commitish);
      repository.fetch('tenniselbow', repo, commitish, function (err) {
        if (err) { return done(err); }
        expect(Git.prototype.checkout.calledWith(commitish)).to.be.false();
        done();
      });
    });

    it('should return the commitish cache path', function(done) {
      var repo = 'git@github.com:super/duper';
      var commitish = 'abc123';
      var commitishPath = repository.getCommitishPath(repo, commitish);
      repository.fetch('some/key', repo, commitish, function (err, path) {
        if (err) { return done(err); }
        expect(path).to.equal(commitishPath);
        done();
      });
    });
  }); // end 'fetch'
}); // end 'repository'
