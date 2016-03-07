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
const Transformer = require('fs-transform')
const monitor = require('monitor-dog')
const transform = require('../../lib/transform')
const repository = require('../../lib/repository')
const MockResponse = require('../fixtures/mock-response')
const deployKey = require('../../lib/deploy-key')
const cache = require('../../lib/cache')
const errorCat = require('../../lib/error')
const noop = require('101/noop')

describe('transform', () => {
  const validRepo = 'git@github.com:org/repo'
  const rootPath = '/tmp/example'
  const response = new MockResponse()

  const deployKeyFetchTimer = { stop: noop }
  const fetchTimer = { stop: noop }
  const transformTimer = { stop: noop }
  const sshKeyPath = '/some/path/ssh-key'

  const transformer = {
    warnings: ['A warning', 'Another warning'],
    getDiff: () => { return 'woot' },
    getScript: () => { return 'sauce' }
  }

  const request = {
    query: {
      repo: validRepo,
      commitish: 'commitish',
      deployKey: '/deploy/key/path'
    },
    body: [
      { action: 'rename', source: 'A', dest: 'B' },
      { action: 'replace', search: 'foo', replace: 'bar' }
    ]
  }

  beforeEach((done) => {
    sinon.stub(deployKey, 'fetch').yieldsAsync(null, sshKeyPath)
    sinon.stub(repository, 'fetch').yieldsAsync(null, rootPath)
    sinon.stub(Transformer, 'dry').yieldsAsync(null, transformer)
    sinon.stub(monitor, 'timer')
      .onFirstCall().returns(deployKeyFetchTimer)
      .onSecondCall().returns(fetchTimer)
      .onThirdCall().returns(transformTimer)
    sinon.spy(fetchTimer, 'stop')
    sinon.spy(transformTimer, 'stop')
    sinon.spy(deployKeyFetchTimer, 'stop')
    sinon.stub(cache, 'unlock').yieldsAsync()
    sinon.spy(errorCat, 'create')
    done()
  })

  afterEach((done) => {
    deployKey.fetch.restore()
    repository.fetch.restore()
    Transformer.dry.restore()
    monitor.timer.restore()
    fetchTimer.stop.restore()
    transformTimer.stop.restore()
    deployKeyFetchTimer.stop.restore()
    cache.unlock.restore()
    errorCat.create.restore()
    done()
  })

  describe('validations', () => {
    it('should respond 400 if repository is missing', (done) => {
      const req = {
        query: { commitish: 'commitish', deployKey: '/some/path' },
        body: []
      }
      transform.applyRules(req, response, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(errorCat.create.calledOnce).to.be.true()
        expect(errorCat.create.calledWith(
          400, 'Parameter `repo` is required.'
        )).to.be.true()
        done()
      })
    })

    it('should respond 400 if the repository is malformed', (done) => {
      const req = {
        query: {
          commitish: 'commitish',
          deployKey: '/some/path',
          repo: 'pzzzklskd,d,---s'
        },
        body: []
      }
      transform.applyRules(req, response, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(errorCat.create.calledOnce).to.be.true()
        expect(errorCat.create.calledWith(
          400,
          'Parameter `repo` is not in the form: ' +
          'git@github.com:Organization/Repository'
        )).to.be.true()
        done()
      })
    })

    it('should respond 400 if commitish is missing', (done) => {
      const req = {
        query: { repo: validRepo, deployKey: '/some/path' },
        body: []
      }
      transform.applyRules(req, response, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(errorCat.create.calledOnce).to.be.true()
        expect(errorCat.create.calledWith(
          400, 'Parameter `commitish` is required.'
        )).to.be.true()
        done()
      })
    })

    it('should respond 400 if the deploy key is missing', (done) => {
      const req = {
        query: { repo: validRepo, commitish: 'commitish' },
        body: []
      }
      transform.applyRules(req, response, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(errorCat.create.calledOnce).to.be.true()
        expect(errorCat.create.calledWith(
          400, 'Parameter `deployKey` is required.'
        )).to.be.true()
        done()
      })
    })

    it('should respond 400 if the body is not an array of rules', (done) => {
      const req = {
        query: {
          repo: validRepo,
          commitish: 'commitish',
          deployKey: '/some/path'
        }
      }
      transform.applyRules(req, response, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(errorCat.create.calledOnce).to.be.true()
        expect(errorCat.create.calledWith(
          400, 'Body must be an array of transform rules.'
        )).to.be.true()
        done()
      })
    })
  }) // end 'validations'

  describe('applyRules', () => {
    it('should fetch the deploy key', (done) => {
      response.once('json', () => {
        expect(deployKey.fetch.calledOnce).to.be.true()
        expect(deployKey.fetch.calledWith(request.query.deployKey))
          .to.be.true()
        done()
      })
      transform.applyRules(request, response)
    })

    it('should time the deploy key fetch', (done) => {
      response.once('json', () => {
        expect(monitor.timer.calledWith('key.time')).to.be.true()
        expect(deployKeyFetchTimer.stop.calledOnce).to.be.true()
        done()
      })
      transform.applyRules(request, response)
    })

    it('should fetch the repository', (done) => {
      response.once('json', () => {
        expect(repository.fetch.calledOnce).to.be.true()

        expect(repository.fetch.calledWith(
          sshKeyPath, // Yielded from deployKey.fetch
          request.query.repo,
          request.query.commitish
        )).to.be.true()
        done()
      })
      transform.applyRules(request, response)
    })

    it('should time the repository fetch', (done) => {
      response.once('json', () => {
        expect(monitor.timer.calledWith('repository.time')).to.be.true()
        expect(fetchTimer.stop.calledOnce).to.be.true()
        done()
      })
      transform.applyRules(request, response)
    })

    it('should apply given transformations', (done) => {
      response.once('json', () => {
        expect(Transformer.dry.calledOnce).to.be.true()
        expect(Transformer.dry.calledWith(rootPath, request.body)).to.be.true()
        done()
      })
      transform.applyRules(request, response)
    })

    it('should time the application of transformations', (done) => {
      response.once('json', () => {
        expect(monitor.timer.calledWith('transform.time')).to.be.true()
        expect(transformTimer.stop.calledOnce).to.be.true()
        done()
      })
      transform.applyRules(request, response)
    })

    it('should yield transformation errors', (done) => {
      const error = new Error('howdydoody')
      Transformer.dry.yieldsAsync(error)
      transform.applyRules(request, response, (err) => {
        expect(err).to.equal(error)
        done()
      })
    })

    it('should unlock the commitish directory', (done) => {
      response.once('json', () => {
        expect(cache.unlock.calledWith(rootPath)).to.be.true()
        done()
      })
      transform.applyRules(request, response)
    })

    it('should yield unlock errors', (done) => {
      const error = new Error('teenagemutantninjaturtles')
      cache.unlock.yieldsAsync(error)
      transform.applyRules(request, response, (err) => {
        expect(err).to.equal(error)
        done()
      })
    })

    it('should respond with the correct data', (done) => {
      response.once('json', (object) => {
        expect(object.warnings).to.deep.equal(transformer.warnings)
        expect(object.diff).to.equal(transformer.getDiff())
        expect(object.script).to.equal(transformer.getScript())
        done()
      })
      transform.applyRules(request, response)
    })

    it('should yield repository fetch errors', (done) => {
      const error = new Error('Fetch error')
      repository.fetch.yields(error)
      transform.applyRules(request, response, (err) => {
        expect(err).to.equal(error)
        done()
      })
    })

    it('should yield transformation errors', (done) => {
      const error = new Error('Transform error')
      Transformer.dry.yields(error)
      transform.applyRules(request, response, (err) => {
        expect(err).to.equal(error)
        done()
      })
    })
  })
})
