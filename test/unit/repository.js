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
var Git = require('../../lib/git');
var repository = require('../../lib/repository');
var cache = require('../../lib/cache');
var errorCat = require('../../lib/error');

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
      sinon.stub(fs, 'existsSync').returns(false)
        .onThirdCall().returns(true);
      sinon.stub(childProcess, 'exec').yieldsAsync();
      sinon.stub(Git.prototype, 'clone').yieldsAsync();
      sinon.stub(Git.prototype, 'getSHA').yieldsAsync(null, 'somesha');
      sinon.stub(Git.prototype, 'fetchAll').yieldsAsync();
      sinon.stub(Git.prototype, 'checkout').yieldsAsync();
      sinon.spy(Git.prototype, '_setup');
      sinon.stub(cache, 'lock').yieldsAsync();
      sinon.stub(cache, 'touch').yieldsAsync();
      sinon.stub(cache, 'unlock').yieldsAsync();
      sinon.spy(repository.log, 'info');
      sinon.spy(repository.log, 'debug');
      sinon.spy(repository.log, 'error');
      sinon.spy(repository.log, 'trace');
      sinon.spy(errorCat, 'wrap');
      sinon.spy(errorCat, 'create');
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
      cache.unlock.restore();
      repository.log.info.restore();
      repository.log.debug.restore();
      repository.log.error.restore();
      repository.log.trace.restore();
      errorCat.wrap.restore();
      errorCat.create.restore();
      done();
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
        expect(fs.existsSync.calledWith(path)).to.be.true();
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
      var repo = 'git@github.com:daredevil/hitlist';
      var repoPath = repository.getRepoPath(repo)
      var command = 'mkdir -p ' + repoPath;
      var key = 'blind/justice';

      fs.existsSync.restore();
      sinon.stub(fs, 'existsSync', function (path) {
        return path === repoPath + '/.git' || path === key;
      });

      repository.fetch(key, repo, 'karate', function (err) {
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
      var repo = 'git@github.com:toad/hut';
      var key = 'mushroom/hat';
      var repoPath = repository.getRepoPath(repo);
      fs.existsSync.restore();
      sinon.stub(fs, 'existsSync', function (path) {
        return path === repoPath + '/.git' || path === key;
      });
      repository.fetch(key, repo, 'tinyjumps', function(err) {
        if (err) { return done(err); }
        expect(Git.prototype.clone.calledWith(repo, repoPath))
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
      fs.existsSync.returns(true);
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

    it('should fetch all if the sha could not be found', function(done) {
      var repo = 'git@github.com:nirvana/smells-like-teen-spirit';
      Git.prototype.getSHA.yields(null, null);
      repository.fetch('keezzz', repo, '1234', function (err) {
        if (err) { return done(err); }
        expect(Git.prototype.fetchAll.calledOnce).to.be.true();
        done();
      });
    });

    it('should fetch all if the sha is empty', function(done) {
      var repo = 'git@github.com:nirvana/smells-like-teen-spirit';
      Git.prototype.getSHA.yields(null, '');
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

    it('should remove the .git directory from the commitish cache', function(done) {
      var repo = 'git@github.com:sanfrancisco/construction';
      var commitish = '7amjackhammers';
      var path = repository.getCommitishPath(repo, commitish);
      var expectedCommand = 'rm -rf ' + path + '/.git';
      repository.fetch('sosleepy', repo, commitish, function (err) {
        if (err) { return done(err); }
        expect(childProcess.exec.calledWith(expectedCommand)).to.be.true();
        done();
      });
    });

    it('should lock the repo directory before copying to commitish', function(done) {
      var repo = 'git@github.com:holy/rollercoasters';
      var commitish = 'batman';
      var repoPath = repository.getRepoPath(repo);
      var key = 'joker';

      fs.existsSync.restore();
      sinon.stub(fs, 'existsSync', function (path) {
        return path === repoPath + '/.git' || path === key;
      });

      repository.fetch(key, repo, commitish, function (err) {
        if (err) { return done(err); }
        expect(cache.lock.calledWith(repoPath)).to.be.true();
        done();
      });
    });

    it('should unlock the repo directory after copying to commitish', function(done) {
      var repo = 'git@github.com:holy/crazypeople';
      var commitish = 'robin';
      var repoPath = repository.getRepoPath(repo);
      var key = 'twoface';

      fs.existsSync.restore();
      sinon.stub(fs, 'existsSync', function (path) {
        return path === repoPath + '/.git' || path === key;
      });

      repository.fetch(key, repo, commitish, function (err) {
        if (err) { return done(err); }
        expect(cache.unlock.calledWith(repoPath)).to.be.true();
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

    it('should log spinlock acquisitions at `trace`', function(done) {
      var repo = 'git@github.com:awesome/sauce';
      var commitish = 'abc12343';
      var repoPath = repository.getRepoPath(repo);
      var commitishPath = repository.getCommitishPath(repo, commitish);
      repository.fetch('some/key/yo', repo, commitish, function (err, path) {
        if (err) { return done(err); }
        expect(repository.log.trace.calledWith(
          'Spin-lock acquired: ' + repoPath
        )).to.be.true();
        expect(repository.log.trace.calledWith(
          'Spin-lock acquired: ' + commitishPath
        )).to.be.true();
        done();
      });
    });

    it('should log spinlock frees at `trace`', function(done) {
      var repo = 'git@github.com:crazy/cool';
      var commitish = 'Axddndkndbc3';
      var repoPath = repository.getRepoPath(repo);
      var commitishPath = repository.getCommitishPath(repo, commitish);
      repository.fetch('some/key/yoshi', repo, commitish, function (err, path) {
        if (err) { return done(err); }
        expect(repository.log.trace.calledWith(
          'Spin-lock freed: ' + repoPath
        )).to.be.true();
        expect(repository.log.trace.calledWith(
          'Spin-lock freed: ' + commitishPath
        )).to.be.true();
        done();
      });
    });

    it('should log the fetch at `info`', function(done) {
      var repo = 'git@github.com:lazy/school';
      var commitish = '38hfsdif39n';
      repository.fetch('totes/good', repo, commitish, function (err, path) {
        if (err) { return done(err); }
        expect(repository.log.info.calledWith(
          'Fetching repository ' + repo + '#' + commitish
        )).to.be.true();
        done();
      });
    });

    it('should log cache hits at `debug`', function(done) {
      fs.existsSync.returns(true);
      var repo = 'git@github.com:grazy/schpool';
      var commitish = 'n294nndlw02';
      repository.fetch('goats/great', repo, commitish, function (err, path) {
        if (err) { return done(err); }
        expect(repository.log.debug.calledWith(
          'Cache hit for ' + repo + '#' + commitish
        )).to.be.true();
        done();
      });
    });

    it('should yield a Boom 500 if the ssh key is missing', function(done) {
      fs.existsSync.onThirdCall().returns(false);
      var repo = 'git@github.com:ipitythe/fool';
      var commitish = '209s,,,dksj2';
      var key = 'moats/fate';
      repository.fetch(key, repo, commitish, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(errorCat.create.calledWith(
          500, 'repository.fetch: Could not find ssh key'
        )).to.be.true();
        expect(errorCat.create.firstCall.args[2])
          .to.deep.equal({ key: key });
        done();
      });
    });

    it('should yield a Boom 500 if the repository cache create fails', function(done) {
      var error = new Error('mkdir is apathetic with concern to your desires');
      childProcess.exec.yieldsAsync(error)
      var repo = 'git@github.com:slam/jam';
      var commitish = '1234567890';
      var repoPath = repository.getRepoPath(repo);
      repository.fetch('bloats/hate', repo, commitish, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(errorCat.wrap.calledWith(
          error, 500, 'repository.fetchFromRemote.createRepoDirectory'
        )).to.be.true();
        expect(err.data.path).to.equal(repoPath);
        done();
      });
    });

    it('should yield a Boom 502 if the repository clone fails', function(done) {
      var error = new Error('did you mean git OWNED?');
      Git.prototype.clone.yieldsAsync(error);
      var repo = 'git@github.com:Wow/Neat';
      var commitish = '#v1.2.3';
      repository.fetch('some/key', repo, commitish, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(err.output.payload.statusCode).to.equal(502);
        expect(errorCat.wrap.calledWith(
          error, 502, 'repository.fetchFromRemote.createRepoDirectory'
        )).to.be.true();
        expect(err.data).to.deep.equal({
          repo: repo,
          path: repository.getRepoPath(repo)
        });
        done();
      });
    });

    it('should yield a Boom 500 if the commitish directory create fails', function(done) {
      var error = new Error('cp is being a brat today, try after his nap');
      childProcess.exec.onSecondCall().yieldsAsync(error);
      var repo = 'git@github.com:So/Smooth';
      var commitish = '#v1.awesome';
      repository.fetch('das/kehy', repo, commitish, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(err.output.payload.statusCode).to.equal(500);
        expect(errorCat.wrap.calledWith(
          error, 500, 'repository.fetchFromRemote.createCommitishDir'
        )).to.be.true();
        expect(err.data).to.deep.equal({
          repo: repo,
          commitish: commitish,
          repositoryPath: repository.getRepoPath(repo),
          commitishPath: repository.getCommitishPath(repo, commitish)
        });
        done();
      });
    });

    it('should yield a Boom 500 if the SHAs comparison fails', function(done) {
      var error = new Error('Did you mean git die in a fire?');
      Git.prototype.getSHA.yieldsAsync(error);
      var repo = 'git@github.com:super/powers';
      var commitish = '#v101010101000101';
      repository.fetch('sssssskeeeyss', repo, commitish, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(err.output.payload.statusCode).to.equal(500);
        expect(errorCat.wrap.calledWith(
          error, 500, 'repository.fetchFromRemote.compareSHAs'
        )).to.be.true();
        expect(err.data).to.deep.equal({
          repo: repo,
          commitish: commitish
        });
        done();
      });
    });

    it('should yield a Boom 502 if the fetch all fails', function(done) {
      var error = new Error('Did you mean git flinch?');
      Git.prototype.fetchAll.yieldsAsync(error);
      var repo = 'git@github.com:austin/powers';
      var commitish = '#v200.3.28282819';
      var key = 'keysaregood';
      repository.fetch(key, repo, commitish, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(err.output.payload.statusCode).to.equal(502);
        expect(errorCat.wrap.calledWith(
          error, 502, 'repository.fetchFromRemote.fetchAll'
        )).to.be.true();
        expect(err.data).to.deep.equal({
          deployKey: key,
          repo: repo
        });
        done();
      });
    });

    it('should yield a Boom 500 if the checkout fails', function(done) {
      var error = new Error('Did you mean git body check into boards?');
      Git.prototype.checkout.yieldsAsync(error);
      var repo = 'git@github.com:double/trouble';
      var commitish = '#v2';
      repository.fetch('keyz', repo, commitish, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(err.output.payload.statusCode).to.equal(500);
        expect(errorCat.wrap.calledWith(
          error, 500, 'repository.fetchFromRemote.checkout'
        )).to.be.true();
        expect(err.data).to.deep.equal({
          repo: repo,
          commitish: commitish
        });
        done();
      });
    });

    it('should yield a Boom 500 if the .git removal fails', function(done) {
      var error = new Error('Did you mean git body check into boards?');
      childProcess.exec.onThirdCall().yieldsAsync(error);
      var repo = 'git@github.com:triple/threat';
      var commitish = '#v2.4';
      var commitishPath = repository.getCommitishPath(repo, commitish);
      var rmCommand = 'rm -rf ' + commitishPath + '/.git';
      repository.fetch('keylimepie', repo, commitish, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(err.output.payload.statusCode).to.equal(500);
        expect(errorCat.wrap.calledWith(
          error, 500, 'repository.fetchFromRemote.removeDotGit'
        )).to.be.true();
        expect(err.data).to.deep.equal({
          commitishPath: commitishPath,
          command: rmCommand
        });
        done();
      });
    });
  }); // end 'fetch'
}); // end 'repository'
