'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const Code = require('code')
const expect = Code.expect
const sinon = require('sinon')

const OptimusClient = require('../../client')

describe('client', () => {
  describe('constructor', () => {
    it('should use environment for default host', (done) => {
      process.env.OPTIMUS_HOST = 'http://optimus.com'
      delete process.env.OPTIMUS_PORT
      const client = new OptimusClient()
      expect(client.host).to.equal('http://optimus.com:80')
      done()
    })

    it('should use given host override', (done) => {
      process.env.OPTIMUS_HOST = 'http://optimus.com'
      delete process.env.OPTIMUS_PORT
      const client = new OptimusClient('http://wow.com')
      expect(client.host).to.equal('http://wow.com:80')
      done()
    })

    it('should use environment for default port', (done) => {
      process.env.OPTIMUS_HOST = 'http://optimus.com'
      process.env.OPTIMUS_PORT = '8989'
      const client = new OptimusClient()
      expect(client.host).to.equal('http://optimus.com:8989')
      done()
    })

    it('should use given port override', (done) => {
      const client = new OptimusClient('http://powza.com', '9000')
      expect(client.host).to.equal('http://powza.com:9000')
      done()
    })
  }) // end 'constructor'

  describe('transform', () => {
    it('should send a request to the correct route', (done) => {
      const client = new OptimusClient()
      sinon.stub(client, 'put').yieldsAsync()

      const repo = 'git@github.com:runnable/monitor-dog'
      const commitish = 'abcdef123456'
      const deployKey = 'deploy/key'
      const rules = [{ action: 'rename', source: 'foo', dest: 'bar' }]
      const opts = {
        repo: repo,
        commitish: commitish,
        deployKey: deployKey,
        rules: rules
      }

      client.transform(opts, (err) => {
        if (err) { return }

        const expectedPath = '?repo=' + encodeURIComponent(repo) +
          '&commitish=' + encodeURIComponent(commitish) +
          '&deployKey=' + encodeURIComponent(deployKey)

        expect(client.put.calledWith({
          path: expectedPath,
          body: rules,
          json: true
        })).to.be.true()

        done()
      })
    })
  }) // end 'transform'
}) // end 'client'
