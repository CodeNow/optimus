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
const AWS = require('aws-sdk')
const fs = require('fs')
const deployKey = require('../../lib/deploy-key')
const noop = require('101/noop')
const childProcess = require('child_process')
const cache = require('../../lib/cache')
const errorCat = require('../../lib/error')

describe('deploy-key', () => {
  var s3 = { getObject: noop }

  beforeEach((done) => {
    sinon.stub(fs, 'writeFile').yieldsAsync()
    sinon.stub(AWS, 'S3').returns(s3)
    sinon.stub(s3, 'getObject').yieldsAsync(null, { Body: 'foo' })
    sinon.stub(childProcess, 'exec').yieldsAsync()
    sinon.stub(fs, 'existsSync').returns(false)
    sinon.stub(cache, 'touch').yieldsAsync()
    sinon.spy(deployKey.log, 'info')
    sinon.spy(deployKey.log, 'debug')
    sinon.spy(deployKey.log, 'error')
    sinon.spy(deployKey.log, 'fatal')
    sinon.spy(errorCat, 'wrap')
    done()
  })

  afterEach((done) => {
    fs.writeFile.restore()
    AWS.S3.restore()
    s3.getObject.restore()
    childProcess.exec.restore()
    fs.existsSync.restore()
    cache.touch.restore()
    deployKey.log.info.restore()
    deployKey.log.debug.restore()
    deployKey.log.error.restore()
    deployKey.log.fatal.restore()
    errorCat.wrap.restore()
    done()
  })

  describe('getCachePath', () => {
    it('should process environment to determine the cache path', (done) => {
      const keyPath = 'foo/bar/baz'
      const cachePath = process.env.DEPLOY_KEY_CACHE + '/foo.bar.baz'
      expect(deployKey.getCachePath(keyPath)).to.equal(cachePath)
      done()
    })

    it('should strip leading slashes from the keypath', (done) => {
      const keyPath = '/gum/gum/bullet'
      const cachePath = process.env.DEPLOY_KEY_CACHE + '/gum.gum.bullet'
      expect(deployKey.getCachePath(keyPath)).to.equal(cachePath)
      done()
    })
  })

  describe('sshKeyPath', () => {
    it('should correctly resolve a path to the ssh key', (done) => {
      const keyPath = '/go/go/gadget'
      const sshKeyPath = process.env.DEPLOY_KEY_CACHE + '/go.go.gadget/ssh-key'
      expect(deployKey.getSSHKeyPath(keyPath)).to.equal(sshKeyPath)
      done()
    })
  })

  describe('fetch', () => {
    it('should skip fetching keys that are already in cache', (done) => {
      fs.existsSync.returns(true)
      deployKey.fetch('what/whut', () => {
        expect(AWS.S3.callCount).to.equal(0)
        done()
      })
    })

    it('should touch the cache directory when skipping the fetch', (done) => {
      fs.existsSync.returns(true)
      const keyPath = 'wat/wat'
      deployKey.fetch(keyPath, () => {
        expect(cache.touch.calledWith(deployKey.getCachePath(keyPath)))
          .to.be.true()
        done()
      })
    })

    it('should gracefully handle touch errors when skipping fetch', (done) => {
      const error = new Error('touch error')
      fs.existsSync.returns(true)
      cache.touch.yields(error)
      deployKey.fetch('key/path', (err) => {
        expect(err).to.equal(error)
        done()
      })
    })

    it('should create the cache directory for the key', (done) => {
      const key = '/yay/sauce'
      deployKey.fetch(key, (err) => {
        expect(err).to.not.exist()
        const command = 'mkdir -p ' + deployKey.getCachePath(key)
        expect(childProcess.exec.calledWith(command)).to.be.true()
        done()
      })
    })

    it('should not create the cache path if it already exists', (done) => {
      fs.existsSync.onSecondCall().returns(true)
      const key = '/level/1/master-key'
      deployKey.fetch(key, (err) => {
        expect(err).to.not.exist()
        const command = 'mkdir -p ' + deployKey.getCachePath(key)
        expect(childProcess.exec.calledWith(command)).to.be.false()
        done()
      })
    })

    it('should provide s3 with the correct credentials', (done) => {
      deployKey.fetch('/some/path', (err) => {
        if (err) { return done(err) }
        expect(AWS.S3.calledWith({
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
        })).to.be.true()
        done()
      })
    })

    it('should get the correct deploy key object', (done) => {
      const keyPath = '/this/is/a/key/path'
      deployKey.fetch(keyPath, (err) => {
        if (err) { return done(err) }
        expect(s3.getObject.calledWith({
          Bucket: process.env.S3_DEPLOY_KEY_BUCKET,
          Key: keyPath
        })).to.be.true()
        done()
      })
    })

    it('should log deploy key cache hits at `debug`', (done) => {
      const keyPath = '/wowza/plowza'
      const sshKeyPath = deployKey.getSSHKeyPath(keyPath)
      fs.existsSync.returns(true)
      deployKey.fetch(keyPath, (err) => {
        if (err) { return done(err) }
        expect(deployKey.log.debug.calledWith(
          'SSH Key Cache Hit: ' + sshKeyPath
        )).to.be.true()
        done()
      })
    })

    it('should yield a 500 Boom error if the cache create failed', (done) => {
      const error = new Error('wuut?')
      childProcess.exec.yieldsAsync(error)
      deployKey.fetch('a/b', (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(err.output.payload.statusCode).to.equal(500)
        expect(errorCat.wrap.calledWith(
          err, 500, 'deployKey.fetch.createCachePath'
        )).to.be.true()
        done()
      })
    })

    it('should yield 4XX errors from S3', (done) => {
      const error = new Error('This should be a 404')
      error.statusCode = 404
      s3.getObject.yieldsAsync(error)
      deployKey.fetch('sup', (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(err.output.payload.statusCode).to.equal(404)
        expect(errorCat.wrap.calledWith(error, 404, 'deployKey.fetch.downloadKey'))
          .to.be.true()
        done()
      })
    })

    it('should yield 502 Boom error if S3 failed with a 5XX', (done) => {
      const error = new Error('This should be a 404')
      error.statusCode = 509
      s3.getObject.yieldsAsync(error)
      deployKey.fetch('yo', (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(err.output.payload.statusCode).to.equal(502)
        expect(errorCat.wrap.calledWith(error, 502, 'deployKey.fetch.downloadKey'))
          .to.be.true()
        done()
      })
    })

    it('should yield a 500 Boom error if the key file write failed', (done) => {
      const error = new Error('Mi kno rite gud')
      const keyPath = 'knee/flaf'
      const sshKeyPath = deployKey.getSSHKeyPath(keyPath)
      fs.writeFile.yieldsAsync(error)
      deployKey.fetch(keyPath, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(err.output.payload.statusCode).to.equal(500)
        expect(errorCat.wrap.calledWith(error, 500, 'deployKey.fetch.downloadKey'))
          .to.be.true()
        expect(err.data.keyPath).to.equal(sshKeyPath)
        done()
      })
    })

    it('should yield a 500 Boom error if the file permissions could not be changed', (done) => {
      const error = new Error('chmod is taking a schnooze')
      const keyPath = 'wii/braf'
      const sshKeyPath = deployKey.getSSHKeyPath(keyPath)
      childProcess.exec.onSecondCall().yields(error)
      deployKey.fetch(keyPath, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(err.output.payload.statusCode).to.equal(500)
        expect(errorCat.wrap.calledWith(error, 500, 'deployKey.fetch.chmodKey'))
          .to.be.true()
        expect(err.data.keyPath).to.equal(sshKeyPath)
        done()
      })
    })

    it('should log a fetch at `info`', (done) => {
      const keyPath = '/plz/log/me/kthxbye'
      deployKey.fetch(keyPath, (err) => {
        if (err) { return done(err) }
        expect(deployKey.log.info.calledWith(
          'Fetching key from S3: ' + keyPath
        )).to.be.true()
        done()
      })
    })
  }) // end 'fetch'

  describe('exec', () => {
    it('should execute a command with the given key', (done) => {
      const keyPath = 'some/key/path'
      const command = 'rm -f /tmp/some/file'
      const expected = 'ssh-agent sh -c \'' +
        'ssh-add ' + keyPath + ' && ' +
        command + '\''
      deployKey.exec(keyPath, command, () => {
        expect(childProcess.exec.calledWith(expected)).to.be.true()
        done()
      })
    })

    it('should escape special characters in the given command', (done) => {
      const keyPath = 'some/key/path'
      const command = 'cat  & | \' / \\'
      const expected = 'ssh-agent sh -c \'' +
        'ssh-add ' + keyPath + ' && ' +
        'cat  \\& \\| \\\' / \\\\' + '\''

      deployKey.exec(keyPath, command, () => {
        expect(childProcess.exec.calledWith(expected)).to.be.true()
        done()
      })
    })

    it('should allow the passing of options', (done) => {
      const key = 'keezor/the/destroyinator'
      const command = 'who | finger'
      const options = { cwd: '/tmp/wutwut' }
      const expected = 'ssh-agent sh -c \'' +
        'ssh-add ' + key + ' && ' +
        'who \\| finger\''
      deployKey.exec(key, command, options, () => {
        expect(childProcess.exec.calledWith(expected, options)).to.be.true()
        done()
      })
    })

    it('should yield a 500 Boom error when a command fails', (done) => {
      const error = new Error('ssh crunch wrapped command error (by taco bell)')
      childProcess.exec.yieldsAsync(error)
      const command = 'who | finger'
      const keyPath = 'run/for/the/border'
      const sshCommand = 'ssh-agent sh -c \'' +
        'ssh-add ' + keyPath + ' && ' +
        'who \\| finger\''
      deployKey.exec(keyPath, command, (err) => {
        expect(err).to.exist()
        expect(err.isBoom).to.be.true()
        expect(errorCat.wrap.calledWith(error, 500, 'deployKey.exec')).to.be.true()
        expect(err.data.keyPath).to.equal(keyPath)
        expect(err.data.command).to.equal(command)
        expect(err.data.sshCommand).to.equal(sshCommand)
        done()
      })
    })
  }) // end 'exec'
}) // end 'deploy-key'
