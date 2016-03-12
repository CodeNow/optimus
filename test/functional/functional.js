'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const before = lab.before
const after = lab.after
const Code = require('code')
const expect = Code.expect
const sinon = require('sinon')

require('loadenv')('optimus:env')
const fs = require('fs')
const request = require('request')
const deployKey = require('../../lib/deploy-key')
const repository = require('../../lib/repository')
const app = require('../../lib/app')
const createCounter = require('callback-count')

const fixtureCache = require('../fixtures/fixture-cache')
const applicationRoot = require('app-root-path').toString()

describe('functional', () => {
  before(fixtureCache.create)
  after(fixtureCache.destroy)

  describe('deploy-key', () => {
    it('should fetch deploy keys from S3', (done) => {
      deployKey.fetch('mock/key').asCallback((err) => {
        if (err) { return done(err) }
        const keyPath = process.env.DEPLOY_KEY_CACHE + '/mock.key/ssh-key'
        const mockPath = applicationRoot + '/test/fixtures/mock-ssh-key'
        expect(fs.existsSync(keyPath)).to.be.true()
        const expectedContent = fs.readFileSync(mockPath).toString()
        const fetchedContent = fs.readFileSync(keyPath).toString()
        expect(expectedContent).to.equal(fetchedContent)
        done()
      })
    })

    it('should return an error if the deploy key was not found', (done) => {
      deployKey.fetch('/not/a/thing').asCallback((err) => {
        expect(err.code).to.equal('NoSuchKey')
        done()
      })
    })
  }) // end 'deploy-key'

  // NOTE: This is *not* a unit test, and must be run as a suite
  describe('repository', () => {
    var keyPath

    before((done) => {
      deployKey.fetch('optimus-private').asCallback((err, path) => {
        if (err) { return done(err) }
        keyPath = path
        done()
      })
    })

    it('should clone a repository', (done) => {
      const repo = 'git@github.com:CodeNow/optimus-private-test'
      const commitish = '170bdd7672b75c4a51e394cf5217c97817321b32'
      repository.fetch(keyPath, repo, commitish).asCallback((err, path) => {
        if (err) { return done(err) }
        expect(fs.existsSync(path + '/A.txt')).to.be.true()
        expect(fs.existsSync(path + '/B.txt')).to.be.true()
        expect(fs.existsSync(path + '/C.txt')).to.be.false()
        expect(fs.existsSync(path + '/README.md')).to.be.true()
        done()
      })
    })

    it('should checkout a different commitish of the same repo', (done) => {
      const repo = 'git@github.com:CodeNow/optimus-private-test'
      const commitish = '8dc308afc20330948e74d0b85c116572326ecee5'
      repository.fetch(keyPath, repo, commitish).asCallback((err, path) => {
        if (err) { return done(err) }
        expect(fs.existsSync(path + '/A.txt')).to.be.true()
        expect(fs.existsSync(path + '/B.txt')).to.be.true()
        expect(fs.existsSync(path + '/C.txt')).to.be.true()
        expect(fs.existsSync(path + '/README.md')).to.be.true()
        done()
      })
    })

    it('should check the cache for repositories and commitishes', (done) => {
      const repo = 'git@github.com:CodeNow/optimus-private-test'
      const commitish = '8dc308afc20330948e74d0b85c116572326ecee5'
      const spy = sinon.spy(fs.existsSync)
      repository.fetch(keyPath, repo, commitish).asCallback((err, path) => {
        if (err) { return done(err) }
        expect(spy.calledWith(keyPath)).to.be.false()
        done()
      })
    })

    it('should yield an error if the SSH key is missing', (done) => {
      const repo = 'git@github.com:CodeNow/optimus-private-test'
      const commitish = 'adifferentcommitish'
      repository.fetch('bogus-/keyzz', repo, commitish).asCallback((err, path) => {
        expect(err).to.not.be.null()
        expect(path).to.be.undefined()
        done()
      })
    })
  }) // end 'repository'

  // NOTE: This is *not* a unit test, and must be run as a suite
  describe('PUT /', () => {
    var server
    before((done) => {
      fixtureCache.reset((err) => {
        if (err) { return done(err) }
        server = app.getInstance().listen(process.env.PORT, done)
      })
    })

    after((done) => {
      server.close(done)
    })

    it('should transform a repository', (done) => {
      const key = 'optimus-private'
      const repo = 'git@github.com:CodeNow/optimus-private-test'
      const commitish = '170bdd7672b75c4a51e394cf5217c97817321b32'

      const params = {
        url: 'http://127.0.0.1:' + process.env.PORT + '?' +
          'deployKey=' + encodeURIComponent(key) + '&' +
          'commitish=' + encodeURIComponent(commitish) + '&' +
          'repo=' + encodeURIComponent(repo),
        body: [
          {
            action: 'replace',
            search: 'beta',
            replace: 'omega'
          },
          {
            action: 'rename',
            source: 'B.txt',
            dest: 'W.txt'
          }
        ],
        json: true
      }

      request.put(params, (err, response, body) => {
        if (err) { return done(err) }
        const expectedKeys = ['warnings', 'diff', 'results', 'script']
        expectedKeys.forEach((key) => {
          expect(body[key]).to.exist()
        })
        done()
      })
    })

    it('should correctly handle multiple quick requests', (done) => {
      const key = 'optimus-private'
      const repo = 'git@github.com:CodeNow/optimus-private-test'
      const commitish = 'f9394ecda04836b9453f113b37e93008c08822ee'
      const url = 'http://127.0.0.1:' + process.env.PORT + '?' +
        'deployKey=' + encodeURIComponent(key) + '&' +
        'commitish=' + encodeURIComponent(commitish) + '&' +
        'repo=' + encodeURIComponent(repo)

      const bodyOne = [{ action: 'replace', search: 'beta', replace: 'omega' }]
      const bodyTwo = [{ action: 'rename', search: 'wow/D.txt', replace: 'D.txt' }]
      const bodyThree = [{ action: 'replace', search: 'alpha', replace: 'AAA' }]

      const counter = createCounter(3, done)

      request.put(
        {url: url, body: bodyOne, json: true},
        (err, response, body) => {
          if (err) { return done(err) }
          counter.next()
        }
      )

      request.put(
        {url: url, body: bodyTwo, json: true},
        (err, response, body) => {
          if (err) { return done(err) }
          counter.next()
        }
      )

      request.put(
        {url: url, body: bodyThree, json: true},
        (err, response, body) => {
          if (err) { return done(err) }
          counter.next()
        }
      )
    })
  }) // end 'PUT /'

  describe('app', () => {
    var server
    before((done) => {
      server = app.getInstance().listen(process.env.PORT, done)
    })

    after((done) => {
      server.close(done)
    })

    it('should return a 404 for an unknown route', (done) => {
      const url = `http://127.0.0.1:${process.env.PORT}/not-there`
      request.get({ url: url, json: true }, (err, response, body) => {
        if (err) { return done(err) }
        expect(response.statusCode).to.equal(404)
        expect(body).to.equal('Not Found')
        done()
      })
    })
  })
}) // end 'functional'
