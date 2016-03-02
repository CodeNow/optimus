'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const beforeEach = lab.beforeEach
const afterEach = lab.afterEach
const Code = require('code')
const expect = Code.expect
const sinon = require('sinon')

require('loadenv')('optimus:env')
const fs = require('fs')
const childProcess = require('child_process')
const Git = require('../../lib/git')
const repository = require('../../lib/repository')
const cache = require('../../lib/cache')
const errorCat = require('../../lib/error')

describe('repository', () => {
  describe('getRepoPath', () => {
    it('should return a correct repository cache path', (done) => {
      const repo = 'git@github.com:runnable/fs-transform'
      const expectedPath = process.env.REPOSITORY_CACHE +
        '/runnable.fs-transform'
      expect(repository.getRepoPath(repo)).to.equal(expectedPath)
      done()
    })

    it('should return null if the given repo was malformed', (done) => {
      const malformed = 'hdfskbnskna000222zeldarules'
      expect(repository.getRepoPath(malformed)).to.be.null()
      done()
    })
  }) // end 'getRepoPath'

  describe('getCommitishPath', () => {
    it('should return a correct commitish cache path', (done) => {
      const repo = 'git@github.com:gannon/power'
      const commitish = 'triforce'
      const expectedPath = process.env.COMMITISH_CACHE +
        '/gannon.power.triforce'
      expect(repository.getCommitishPath(repo, commitish))
        .to.equal(expectedPath)
      done()
    })

    it('should return null if the given repo was malformed', (done) => {
      const malformed = 'superduperpooperscooper'
      expect(repository.getCommitishPath(malformed, 'anything')).to.be.null()
      done()
    })
  }) // end 'getCommitishPath'

  describe('fetch', () => {
    beforeEach((done) => {
      sinon.stub(fs, 'existsSync').returns(false)
        .onThirdCall().returns(true)
      sinon.stub(childProcess, 'exec').yieldsAsync()
      sinon.stub(Git.prototype, 'clone').yieldsAsync()
      sinon.stub(Git.prototype, 'getSHA').yieldsAsync(null, 'somesha')
      sinon.stub(Git.prototype, 'fetchAll').yieldsAsync()
      sinon.stub(Git.prototype, 'checkout').yieldsAsync()
      sinon.spy(Git.prototype, '_setup')
      sinon.stub(cache, 'lock').yieldsAsync()
      sinon.stub(cache, 'touch').yieldsAsync()
      sinon.stub(cache, 'unlock').yieldsAsync()
      sinon.spy(repository.log, 'info')
      sinon.spy(repository.log, 'debug')
      sinon.spy(repository.log, 'error')
      sinon.spy(repository.log, 'trace')
      sinon.spy(errorCat, 'wrap')
      sinon.spy(errorCat, 'create')
      done()
    })

    afterEach((done) => {
      fs.existsSync.restore()
      childProcess.exec.restore()
      Git.prototype.clone.restore()
      Git.prototype.getSHA.restore()
      Git.prototype.fetchAll.restore()
      Git.prototype.checkout.restore()
      Git.prototype._setup.restore()
      cache.lock.restore()
      cache.touch.restore()
      cache.unlock.restore()
      repository.log.info.restore()
      repository.log.debug.restore()
      repository.log.error.restore()
      repository.log.trace.restore()
      errorCat.wrap.restore()
      errorCat.create.restore()
      done()
    })

    it('should check the existence of the repository directory', (done) => {
      const repo = 'git@github.com:example/sauce'
      const path = repository.getRepoPath(repo)

      repository.fetch('a/key', repo, '3455', (err) => {
        if (err) { return done(err) }
        expect(fs.existsSync.calledWith(path + '/.git')).to.be.true()
        done()
      })
    })

    it('should check the existence of the commitish directory', (done) => {
      const repo = 'git@github.com:totes/magoats'
      const commitish = 'c0mitti5h'
      const path = repository.getCommitishPath(repo, commitish)
      repository.fetch('a/key', repo, commitish, (err) => {
        if (err) { return done(err) }
        expect(fs.existsSync.calledWith(path)).to.be.true()
        done()
      })
    })

    it('should bypass fetch if repo and commitish are cached', (done) => {
      fs.existsSync.returns(true)
      const repo = 'git@github.com:westeros/hodor'
      const commitish = 'hodoorrrrr'
      const expectedPath = repository.getCommitishPath(repo, commitish)
      repository.fetch('das/key', repo, commitish, (err, path) => {
        if (err) { return done(err) }
        expect(childProcess.exec.callCount).to.equal(0)
        expect(Git.prototype.clone.callCount).to.equal(0)
        expect(Git.prototype.getSHA.callCount).to.equal(0)
        expect(Git.prototype.fetchAll.callCount).to.equal(0)
        expect(Git.prototype.checkout.callCount).to.equal(0)
        expect(path).to.equal(expectedPath)
        done()
      })
    })

    it('should touch the repo and commitish directories when bypassing', (done) => {
      fs.existsSync.returns(true)
      const repo = 'git@github.com:westeros/cersei'
      const commitish = 'mybrotherishot'
      const repoPath = repository.getRepoPath(repo)
      const commitishPath = repository.getCommitishPath(repo, commitish)
      repository.fetch('dos/key', repo, commitish, (err, path) => {
        if (err) { return done(err) }
        expect(cache.touch.calledWith(repoPath)).to.be.true()
        expect(cache.touch.calledWith(commitishPath)).to.be.true()
        done()
      })
    })

    it('should lock the commitish directory when bypassing', (done) => {
      fs.existsSync.returns(true)
      const repo = 'git@github.com:westeros/catlyn'
      const commitish = 'imtotesundead'
      const commitishPath = repository.getCommitishPath(repo, commitish)
      repository.fetch('dos/equis', repo, commitish, (err, path) => {
        if (err) { return done(err) }
        expect(cache.lock.calledWith(commitishPath)).to.be.true()
        done()
      })
    })

    it('should report errors when bypassing', (done) => {
      const error = new Error('The dragon queen cometh')
      fs.existsSync.returns(true)
      cache.touch.yieldsAsync(error)
      const repo = 'git@github.com:westeros/tyrion'
      const commitish = 'ilikewineandbooks'
      repository.fetch('dos/equis', repo, commitish, (err, path) => {
        expect(err).to.equal(error)
        done()
      })
    })

    it('should set the correct key and path for git', (done) => {
      const key = 'mah/keyzz'
      const repo = 'git@github.com:bowser/powser'
      const commitish = '1234'
      const commitishPath = repository.getCommitishPath(repo, commitish)
      repository.fetch(key, repo, '1234', (err) => {
        if (err) { return done(err) }
        expect(Git.prototype._setup.calledWith(key, commitishPath))
          .to.be.true()
        done()
      })
    })

    it('should create a repository cache directory', (done) => {
      const repo = 'git@github.com:talltales/paul'
      const command = 'mkdir -p ' + repository.getRepoPath(repo)
      repository.fetch('big/axe', repo, 'lumberjack', (err) => {
        if (err) { return done(err) }
        expect(childProcess.exec.calledWith(command)).to.be.true()
        done()
      })
    })

    it('should touch the repository cache directory if it already exists', (done) => {
      const repo = 'git@github.com:daredevil/hitlist'
      const repoPath = repository.getRepoPath(repo)
      const command = 'mkdir -p ' + repoPath
      const key = 'blind/justice'

      fs.existsSync.restore()
      sinon.stub(fs, 'existsSync', (path) => {
        return path === repoPath + '/.git' || path === key
      })

      repository.fetch(key, repo, 'karate', (err) => {
        if (err) { return done(err) }
        expect(childProcess.exec.calledWith(command)).to.be.false()
        expect(cache.touch.calledWith(repoPath)).to.be.true()
        done()
      })
    })

    it('should clone the repository', (done) => {
      const repo = 'git@github.com:luigi/mansion'
      const repositoryPath = repository.getRepoPath(repo)
      repository.fetch('green/hat', repo, 'bigjumps', (err) => {
        if (err) { return done(err) }
        expect(Git.prototype.clone.calledWith(repo, repositoryPath))
          .to.be.true()
        done()
      })
    })

    it('should not clone the repository if it already exists', (done) => {
      const repo = 'git@github.com:toad/hut'
      const key = 'mushroom/hat'
      const repoPath = repository.getRepoPath(repo)
      fs.existsSync.restore()
      sinon.stub(fs, 'existsSync', (path) => {
        return path === repoPath + '/.git' || path === key
      })
      repository.fetch(key, repo, 'tinyjumps', (err) => {
        if (err) { return done(err) }
        expect(Git.prototype.clone.calledWith(repo, repoPath))
          .to.be.false()
        done()
      })
    })

    it('should create the commitish directory', (done) => {
      const repo = 'git@github.com:big/star'
      const commitish = 'radiocity'
      const repoPath = repository.getRepoPath(repo)
      const commitishPath = repository.getCommitishPath(repo, commitish)
      const command = 'cp -r ' + repoPath + ' ' + commitishPath
      repository.fetch('key', repo, commitish, (err) => {
        if (err) { return done(err) }
        expect(childProcess.exec.calledWith(command)).to.be.true()
        done()
      })
    })

    it('should touch the commitish directory if it already exists', (done) => {
      fs.existsSync.returns(true)
      const repo = 'git@github.com:nin/downwardspiral'
      const commitish = 'closer'
      const repoPath = repository.getRepoPath(repo)
      const commitishPath = repository.getCommitishPath(repo, commitish)
      const command = 'cp -r ' + repoPath + ' ' + commitishPath
      repository.fetch('key', repo, commitish, (err) => {
        if (err) { return done(err) }
        expect(cache.touch.calledWith(commitishPath)).to.be.true()
        expect(childProcess.exec.calledWith(command)).to.be.false()
        done()
      })
    })

    it('should lock the commitish directory', (done) => {
      const repo = 'git@github.com:soundgarden/superunknown'
      const commitish = 'spoonman'
      const commitishPath = repository.getCommitishPath(repo, commitish)
      repository.fetch('key', repo, commitish, (err) => {
        if (err) { return done(err) }
        expect(cache.lock.calledWith(commitishPath)).to.be.true()
        done()
      })
    })

    it('should compare the commitish to the cache git sha', (done) => {
      const repo = 'git@github.com:avengers/ultron'
      repository.fetch('kee', repo, 'tonystark', (err) => {
        if (err) { return done(err) }
        expect(Git.prototype.getSHA.calledOnce).to.be.true()
        done()
      })
    })

    it('should yield command errors when getting sha', (done) => {
      const repo = 'git@github.com:lego/technic'
      const error = new Error('Sup playa?')
      Git.prototype.getSHA.yields(error)
      repository.fetch('weeee', repo, 'helicopter', (err) => {
        expect(err).to.equal(error)
        done()
      })
    })

    it('should not compare if the returned sha is empty', (done) => {
      const repo = 'git@github.com:rsandor/solace'
      Git.prototype.getSHA.yields(null, '')
      repository.fetch('mahkey', repo, 'mudsrule', done)
    })

    it('should fetch all if the commitish does not match the sha', (done) => {
      const repo = 'git@github.com:nirvana/smells-like-teen-spirit'
      Git.prototype.getSHA.yields(null, '3456')
      repository.fetch('keezzz', repo, '1234', (err) => {
        if (err) { return done(err) }
        expect(Git.prototype.fetchAll.calledOnce).to.be.true()
        done()
      })
    })

    it('should fetch all if the sha could not be found', (done) => {
      const repo = 'git@github.com:nirvana/smells-like-teen-spirit'
      Git.prototype.getSHA.yields(null, null)
      repository.fetch('keezzz', repo, '1234', (err) => {
        if (err) { return done(err) }
        expect(Git.prototype.fetchAll.calledOnce).to.be.true()
        done()
      })
    })

    it('should fetch all if the sha is empty', (done) => {
      const repo = 'git@github.com:nirvana/smells-like-teen-spirit'
      Git.prototype.getSHA.yields(null, '')
      repository.fetch('keezzz', repo, '1234', (err) => {
        if (err) { return done(err) }
        expect(Git.prototype.fetchAll.calledOnce).to.be.true()
        done()
      })
    })

    it('should not fetch all if the commitish matches the sha', (done) => {
      const repo = 'git@github.com:smooth/criminal'
      const commitish = 'abcdef'
      Git.prototype.getSHA.yields(null, commitish)
      repository.fetch('mj', repo, commitish, (err) => {
        if (err) { return done(err) }
        expect(Git.prototype.fetchAll.calledOnce).to.be.false()
        done()
      })
    })

    it('should checkout if the commitish does not match the sha', (done) => {
      const repo = 'git@github.com:rappers/snoop'
      const commitish = 'oranges'
      Git.prototype.getSHA.yields(null, 'apples')
      repository.fetch('ginandjuice', repo, commitish, (err) => {
        if (err) { return done(err) }
        expect(Git.prototype.checkout.calledWith(commitish)).to.be.true()
        done()
      })
    })

    it('should not checkout if the commitish matches the sha', (done) => {
      const repo = 'git@github.com:happybirthday/bryan'
      const commitish = 'woooo!'
      Git.prototype.getSHA.yields(null, commitish)
      repository.fetch('tenniselbow', repo, commitish, (err) => {
        if (err) { return done(err) }
        expect(Git.prototype.checkout.calledWith(commitish)).to.be.false()
        done()
      })
    })

    it('should remove the .git directory from the commitish cache', (done) => {
      const repo = 'git@github.com:sanfrancisco/construction'
      const commitish = '7amjackhammers'
      const path = repository.getCommitishPath(repo, commitish)
      const expectedCommand = `rm -rf '${path}/.git'`
      repository.fetch('sosleepy', repo, commitish, (err) => {
        if (err) { return done(err) }
        expect(childProcess.exec.calledWith(expectedCommand)).to.be.true()
        done()
      })
    })

    it('should lock the repo directory before copying to commitish', (done) => {
      const repo = 'git@github.com:holy/rollercoasters'
      const commitish = 'batman'
      const repoPath = repository.getRepoPath(repo)
      const key = 'joker'

      fs.existsSync.restore()
      sinon.stub(fs, 'existsSync', (path) => {
        return path === repoPath + '/.git' || path === key
      })

      repository.fetch(key, repo, commitish, (err) => {
        if (err) { return done(err) }
        expect(cache.lock.calledWith(repoPath)).to.be.true()
        done()
      })
    })

    it('should unlock the repo directory after copying to commitish', (done) => {
      const repo = 'git@github.com:holy/crazypeople'
      const commitish = 'robin'
      const repoPath = repository.getRepoPath(repo)
      const key = 'twoface'

      fs.existsSync.restore()
      sinon.stub(fs, 'existsSync', (path) => {
        return path === repoPath + '/.git' || path === key
      })

      repository.fetch(key, repo, commitish, (err) => {
        if (err) { return done(err) }
        expect(cache.unlock.calledWith(repoPath)).to.be.true()
        done()
      })
    })

    it('should return the commitish cache path', (done) => {
      const repo = 'git@github.com:super/duper'
      const commitish = 'abc123'
      const commitishPath = repository.getCommitishPath(repo, commitish)
      repository.fetch('some/key', repo, commitish, (err, path) => {
        if (err) { return done(err) }
        expect(path).to.equal(commitishPath)
        done()
      })
    })

    it('should log spinlock acquisitions at `trace`', (done) => {
      const repo = 'git@github.com:awesome/sauce'
      const commitish = 'abc12343'
      const repoPath = repository.getRepoPath(repo)
      const commitishPath = repository.getCommitishPath(repo, commitish)
      repository.fetch('some/key/yo', repo, commitish, (err, path) => {
        if (err) { return done(err) }
        expect(repository.log.trace.calledWith(
          'Spin-lock acquired: ' + repoPath
        )).to.be.true()
        expect(repository.log.trace.calledWith(
          'Spin-lock acquired: ' + commitishPath
        )).to.be.true()
        done()
      })
    })

    it('should log spinlock frees at `trace`', (done) => {
      const repo = 'git@github.com:crazy/cool'
      const commitish = 'Axddndkndbc3'
      const repoPath = repository.getRepoPath(repo)
      const commitishPath = repository.getCommitishPath(repo, commitish)
      repository.fetch('some/key/yoshi', repo, commitish, (err, path) => {
        if (err) { return done(err) }
        expect(repository.log.trace.calledWith(
          'Spin-lock freed: ' + repoPath
        )).to.be.true()
        expect(repository.log.trace.calledWith(
          'Spin-lock freed: ' + commitishPath
        )).to.be.true()
        done()
      })
    })

    it('should log the fetch at `info`', (done) => {
      const repo = 'git@github.com:lazy/school'
      const commitish = '38hfsdif39n'
      repository.fetch('totes/good', repo, commitish, (err, path) => {
        if (err) { return done(err) }
        expect(repository.log.info.calledWith(
          'Fetching repository ' + repo + '#' + commitish
        )).to.be.true()
        done()
      })
    })

    it('should log cache hits at `debug`', (done) => {
      fs.existsSync.returns(true)
      const repo = 'git@github.com:grazy/schpool'
      const commitish = 'n294nndlw02'
      repository.fetch('goats/great', repo, commitish, (err, path) => {
        if (err) { return done(err) }
        expect(repository.log.debug.calledWith(
          'Cache hit for ' + repo + '#' + commitish
        )).to.be.true()
        done()
      })
    })

    it('should yield a Boom 500 if the ssh key is missing', (done) => {
      fs.existsSync.onThirdCall().returns(false)
      const repo = 'git@github.com:ipitythe/fool'
      const commitish = '209s,,,dksj2'
      const key = 'moats/fate'
      repository.fetch(key, repo, commitish, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(errorCat.create.calledWith(
          500, 'repository.fetch: Could not find ssh key'
        )).to.be.true()
        expect(errorCat.create.firstCall.args[2])
          .to.deep.equal({ key: key })
        done()
      })
    })

    it('should yield a Boom 500 if the repository cache create fails', (done) => {
      const error = new Error('mkdir is apathetic with concern to your desires')
      childProcess.exec.yieldsAsync(error)
      const repo = 'git@github.com:slam/jam'
      const commitish = '1234567890'
      const repoPath = repository.getRepoPath(repo)
      repository.fetch('bloats/hate', repo, commitish, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(errorCat.wrap.calledWith(
          error, 500, 'repository.fetchFromRemote.createRepoDirectory'
        )).to.be.true()
        expect(err.data.path).to.equal(repoPath)
        done()
      })
    })

    it('should yield a Boom 502 if the repository clone fails', (done) => {
      const error = new Error('did you mean git OWNED?')
      Git.prototype.clone.yieldsAsync(error)
      const repo = 'git@github.com:Wow/Neat'
      const commitish = '#v1.2.3'
      repository.fetch('some/key', repo, commitish, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(err.output.payload.statusCode).to.equal(502)
        expect(errorCat.wrap.calledWith(
          error, 502, 'repository.fetchFromRemote.createRepoDirectory'
        )).to.be.true()
        expect(err.data).to.deep.equal({
          repo: repo,
          path: repository.getRepoPath(repo)
        })
        done()
      })
    })

    it('should yield a Boom 500 if the commitish directory create fails', (done) => {
      const error = new Error('cp is being a brat today, try after his nap')
      childProcess.exec.onSecondCall().yieldsAsync(error)
      const repo = 'git@github.com:So/Smooth'
      const commitish = '#v1.awesome'
      repository.fetch('das/kehy', repo, commitish, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(err.output.payload.statusCode).to.equal(500)
        expect(errorCat.wrap.calledWith(
          error, 500, 'repository.fetchFromRemote.createCommitishDir'
        )).to.be.true()
        expect(err.data).to.deep.equal({
          repo: repo,
          commitish: commitish,
          repositoryPath: repository.getRepoPath(repo),
          commitishPath: repository.getCommitishPath(repo, commitish)
        })
        done()
      })
    })

    it('should yield a Boom 500 if the SHAs comparison fails', (done) => {
      const error = new Error('Did you mean git die in a fire?')
      Git.prototype.getSHA.yieldsAsync(error)
      const repo = 'git@github.com:super/powers'
      const commitish = '#v101010101000101'
      repository.fetch('sssssskeeeyss', repo, commitish, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(err.output.payload.statusCode).to.equal(500)
        expect(errorCat.wrap.calledWith(
          error, 500, 'repository.fetchFromRemote.compareSHAs'
        )).to.be.true()
        expect(err.data).to.deep.equal({
          repo: repo,
          commitish: commitish
        })
        done()
      })
    })

    it('should yield a Boom 502 if the fetch all fails', (done) => {
      const error = new Error('Did you mean git flinch?')
      Git.prototype.fetchAll.yieldsAsync(error)
      const repo = 'git@github.com:austin/powers'
      const commitish = '#v200.3.28282819'
      const key = 'keysaregood'
      repository.fetch(key, repo, commitish, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(err.output.payload.statusCode).to.equal(502)
        expect(errorCat.wrap.calledWith(
          error, 502, 'repository.fetchFromRemote.fetchAll'
        )).to.be.true()
        expect(err.data).to.deep.equal({
          deployKey: key,
          repo: repo
        })
        done()
      })
    })

    it('should yield a Boom 500 if the checkout fails', (done) => {
      const error = new Error('Did you mean git body check into boards?')
      Git.prototype.checkout.yieldsAsync(error)
      const repo = 'git@github.com:double/trouble'
      const commitish = '#v2'
      repository.fetch('keyz', repo, commitish, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(err.output.payload.statusCode).to.equal(500)
        expect(errorCat.wrap.calledWith(
          error, 500, 'repository.fetchFromRemote.checkout'
        )).to.be.true()
        expect(err.data).to.deep.equal({
          repo: repo,
          commitish: commitish
        })
        done()
      })
    })

    it('should yield a Boom 500 if the .git removal fails', (done) => {
      const error = new Error('Did you mean git body check into boards?')
      childProcess.exec.onThirdCall().yieldsAsync(error)
      const repo = 'git@github.com:triple/threat'
      const commitish = '#v2.4'
      const commitishPath = repository.getCommitishPath(repo, commitish)
      const rmCommand = `rm -rf '${commitishPath}/.git'`
      repository.fetch('keylimepie', repo, commitish, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(err.output.payload.statusCode).to.equal(500)
        expect(errorCat.wrap.calledWith(
          error, 500, 'repository.fetchFromRemote.removeDotGit'
        )).to.be.true()
        expect(err.data).to.deep.equal({
          commitishPath: commitishPath,
          command: rmCommand
        })
        done()
      })
    })
  }) // end 'fetch'
}) // end 'repository'
