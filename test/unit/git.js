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
const Git = require('../../lib/git')
const deployKey = require('../../lib/deploy-key')

describe('Git', () => {
  const key = '/some/deploy/key'
  const path = '/working/path'
  var git

  beforeEach((done) => {
    git = new Git(key, path)
    sinon.stub(deployKey, 'exec').yieldsAsync()
    sinon.spy(Git.log, 'trace')
    done()
  })

  afterEach((done) => {
    deployKey.exec.restore()
    Git.log.trace.restore()
    done()
  })

  describe('_setup', () => {
    it('should set the appropriate instance variables', (done) => {
      const key = 'dat/key'
      const path = '/dat/path'
      git._setup(key, path)
      expect(git.key).to.equal(key)
      expect(git.path).to.equal(path)
      done()
    })
  })

  describe('clone', () => {
    it('should perform `git clone` for the repository', (done) => {
      const repo = 'git@github.com:Org/Repo'
      git.clone(repo, () => {
        const command = 'git clone -q ' + repo + ' ' + path
        expect(deployKey.exec.calledOnce).to.be.true()
        expect(deployKey.exec.calledWith(key, command)).to.be.true()
        done()
      })
    })

    it('should should use the specified path when supplied', (done) => {
      const repo = 'git@github.com:Org/Repo'
      const givenPath = '/woot/sauce/go/now'
      git.clone(repo, givenPath, () => {
        const command = 'git clone -q ' + repo + ' ' + givenPath
        expect(deployKey.exec.calledOnce).to.be.true()
        expect(deployKey.exec.calledWith(key, command)).to.be.true()
        done()
      })
    })

    it('should log the clone at `trace`', (done) => {
      const repo = 'git@github.com:Michigan/Eucher'
      const path = '/gonna/cheat'
      git.clone(repo, path, () => {
        expect(Git.log.trace.calledWith('Git: cloning ' + repo + ' to ' + path))
          .to.be.true()
        done()
      })
    })
  })

  describe('getSHA', () => {
    it('should get the SHA for the HEAD commit of the repo', (done) => {
      git.getSHA(() => {
        const command = 'git rev-parse HEAD'
        const options = { cwd: path }
        expect(deployKey.exec.calledOnce).to.be.true()
        expect(deployKey.exec.calledWith(key, command, options)).to.be.true()
        done()
      })
    })

    it('should log rev-parse at `trace`', (done) => {
      git.getSHA(() => {
        expect(Git.log.trace.calledWith('Git: SHA from head')).to.be.true()
        done()
      })
    })
  })

  describe('fetchAll', () => {
    it('should fetch all information for a repository', (done) => {
      git.fetchAll(() => {
        const command = 'git fetch --all'
        const options = { cwd: path }
        expect(deployKey.exec.calledOnce).to.be.true()
        expect(deployKey.exec.calledWith(key, command, options)).to.be.true()
        done()
      })
    })

    it('should log the fetch at `trace`', (done) => {
      git.fetchAll(() => {
        expect(Git.log.trace.calledWith('Git: fetch all')).to.be.true()
        done()
      })
    })
  })

  describe('checkout', () => {
    it('should checkout given a commitish', (done) => {
      const commitish = 'usetheforce'
      git.checkout(commitish, () => {
        const command = 'git checkout -q ' + commitish
        const options = { cwd: path }
        expect(deployKey.exec.calledOnce).to.be.true()
        expect(deployKey.exec.calledWith(key, command, options)).to.be.true()
        done()
      })
    })

    it('should log the checkout at `trace`', (done) => {
      const commitish = 'superduperss'
      git.checkout(commitish, () => {
        expect(Git.log.trace.calledWith('Git: checkout ' + commitish))
          .to.be.true()
        done()
      })
    })
  }) // end 'checkout'
})
