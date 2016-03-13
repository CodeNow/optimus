'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const describe = lab.describe
const beforeEach = lab.beforeEach
const afterEach = lab.afterEach
const it = lab.it
const Code = require('code')
const expect = Code.expect
const sinon = require('sinon')

const AWS = require('aws-sdk')
const cache = require('../../lib/cache')
const childProcess = require('child_process')
const DeployKey = require('../../lib/deploy-key')
const fs = require('fs')

describe('unit', () => {
  describe('deploy-key', () => {
    describe('fetch', () => {
      const keyPath = 'some/path'
      const sshKeyPath = DeployKey.getSSHKeyPath(keyPath)

      beforeEach((done) => {
        sinon.stub(AWS, 'S3').returns({
          getObject: sinon.stub().yieldsAsync(null, { Body: 'wow' })
        })
        sinon.stub(cache, 'touch').returns(Promise.resolve())
        sinon.stub(childProcess, 'execFileAsync').returns(Promise.resolve())
        sinon.stub(fs, 'existsSync').returns(false)
        sinon.stub(fs, 'writeFileAsync').returns(Promise.resolve())
        done()
      })

      afterEach((done) => {
        AWS.S3.restore()
        cache.touch.restore()
        childProcess.execFileAsync.restore()
        fs.existsSync.restore()
        fs.writeFileAsync.restore()
        done()
      })

      it('should return the fetched ssh key path', (done) => {
        fs.existsSync.returns(true)
        DeployKey.fetch(keyPath).asCallback((err, path) => {
          expect(err).to.not.exist()
          expect(path).to.equal(sshKeyPath)
          done()
        })
      })

      it('should return the fetched with a cached path ssh key path', (done) => {
        fs.existsSync.onSecondCall().returns(true)
        DeployKey.fetch(keyPath).asCallback((err, path) => {
          expect(err).to.not.exist()
          expect(path).to.equal(sshKeyPath)
          done()
        })
      })

      it('should return the cached ssh key path', (done) => {
        fs.existsSync.returns(true)
        DeployKey.fetch(keyPath).asCallback((err, path) => {
          expect(err).to.not.exist()
          expect(path).to.equal(sshKeyPath)
          done()
        })
      })
    }) // end 'fetch'
  }) // end 'DeployKey'
}) // end 'unit'
