'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const before = lab.before
const after = lab.after
const Code = require('code')
const expect = Code.expect

require('loadenv')('optimus:env')
const app = require('../../lib/app')
const fixtureCache = require('../fixtures/fixture-cache')
const client = require('../../client')

describe('functional', () => {
  var server

  before((done) => {
    fixtureCache.create((err) => {
      if (err) { return done(err) }
      server = app.getInstance().listen(process.env.PORT, done)
    })
  })

  after((done) => {
    server.close((err) => {
      if (err) { return done(err) }
      fixtureCache.destroy(done)
    })
  })

  describe('client', () => {
    it('should call the server to perform a transforms', (done) => {
      const options = {
        rules: [
          { action: 'replace', search: 'alpha', replace: 'iota' },
          { action: 'rename', source: 'README.md', dest: 'README' }
        ],
        repo: 'git@github.com:CodeNow/optimus-private-test',
        deployKey: 'optimus-private',
        commitish: 'f9394ecda04836b9453f113b37e93008c08822ee'
      }
      client.transform(options, (err, resp) => {
        if (err) { return done(err) }
        expect(resp.statusCode).to.equal(200)
        expect(resp.body.warnings).to.be.an.array()
        expect(resp.body.diff).to.be.a.string()
        expect(resp.body.script).to.be.a.string()
        expect(resp.body.results).to.be.an.array()
        done()
      })
    })

    it('should handle errors', (done) => {
      const options = {
        rules: [ { action: 'replace', search: 'alpha', replace: 'iota' } ],
        repo: 'git@github.com:CodeNow/optimus-private-test',
        deployKey: 'invalid-key',
        commitish: 'f9394ecda04836b9453f113b37e93008c08822ee'
      }
      client.transform(options, (err, resp) => {
        if (err) { return done(err) }
        expect(resp.statusCode).to.equal(404)
        done()
      })
    })
  })
})
