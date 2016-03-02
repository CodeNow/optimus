'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach
var Code = require('code')
var expect = Code.expect
var sinon = require('sinon')

require('loadenv')('optimus:env')
var childProcess = require('child_process')
var cache = require('../../lib/cache')
var errorCat = require('../../lib/error')

describe('cache', () => {
  beforeEach((done) => {
    sinon.stub(childProcess, 'exec').yieldsAsync()
    sinon.spy(cache.log, 'info')
    sinon.spy(cache.log, 'debug')
    sinon.spy(cache.log, 'error')
    sinon.spy(cache.log, 'fatal')
    sinon.spy(errorCat, 'wrap')
    done()
  })

  afterEach((done) => {
    childProcess.exec.restore()
    cache.log.info.restore()
    cache.log.debug.restore()
    cache.log.error.restore()
    cache.log.fatal.restore()
    errorCat.wrap.restore()
    done()
  })

  describe('initialize', () => {
    it('should create each missing cache path', (done) => {
      cache.initialize((err) => {
        if (err) { return done(err) }
        const cmd1 = 'mkdir -p ' + process.env.DEPLOY_KEY_CACHE
        expect(childProcess.exec.calledWith(cmd1)).to.be.true()
        const cmd2 = 'mkdir -p ' + process.env.REPOSITORY_CACHE
        expect(childProcess.exec.calledWith(cmd2)).to.be.true()
        const cmd3 = 'mkdir -p ' + process.env.COMMITISH_CACHE
        expect(childProcess.exec.calledWith(cmd3)).to.be.true()
        done()
      })
    })

    it('should log cache initialization at `info`', (done) => {
      cache.initialize((err) => {
        if (err) { return done(err) }
        expect(cache.log.info.calledWith('Initializing file system caches'))
          .to.be.true()
        done()
      })
    })

    it('should log failed cache initialization at `fatal`', (done) => {
      const error = new Error('Cache init failure')
      childProcess.exec.yieldsAsync(error)
      cache.initialize((err) => {
        const msg = 'Unable to initialize cache: ' + process.env.DEPLOY_KEY_CACHE
        expect(cache.log.fatal.calledWith(err, msg)).to.be.true()
        done()
      })
    })

    it('should log each cache creatiion at `debug`', (done) => {
      cache.initialize((err) => {
        if (err) { return done(err) }
        expect(cache.log.debug.callCount).to.equal(3)
        expect(cache.log.debug.calledWith(
          'Cache initialized: ' + process.env.DEPLOY_KEY_CACHE
        )).to.be.true()
        expect(cache.log.debug.calledWith(
          'Cache initialized: ' + process.env.REPOSITORY_CACHE
        )).to.be.true()
        expect(cache.log.debug.calledWith(
          'Cache initialized: ' + process.env.COMMITISH_CACHE
        )).to.be.true()
        done()
      })
    })
  }) // end 'initialize'

  describe('touch', () => {
    it('should execute a touch on the given path', (done) => {
      cache.touch('/foo/bar', (err) => {
        if (err) { return done(err) }
        expect(childProcess.exec.calledWith('touch /foo/bar')).to.be.true()
        done()
      })
    })

    it('should yield a Boom 500 error on failure', (done) => {
      const error = new Error('Touch error')
      const path = '/bar/baz'
      childProcess.exec.yieldsAsync(error)
      cache.touch(path, (err) => {
        expect(err.isBoom).to.be.true()
        expect(errorCat.wrap.calledWith(error, 500, 'cache.touch'))
          .to.be.true()
        done()
      })
    })
  }) // end 'touch'

  describe('lock', () => {
    it('should create a lock directory in the given path', (done) => {
      cache.lock('/tmp/wow', (err) => {
        if (err) { return done(err) }
        expect(childProcess.exec.calledWith('mkdir -p /tmp/wow/.optimus_lock'))
          .to.be.true()
        done()
      })
    })

    it('should yield a Boom 500 error on failure', (done) => {
      const error = new Error('Lock error')
      const path = '/path/to/lock'
      childProcess.exec.yieldsAsync(error)
      cache.lock(path, (err) => {
        expect(err.isBoom).to.be.true()
        expect(errorCat.wrap.calledWith(error, 500, 'cache.lock')).to.be.true()
        done()
      })
    })
  }) // end 'lock'

  describe('unlock', () => {
    it('should remove the lock file from the given path', (done) => {
      cache.unlock('/tmp/how', (err) => {
        if (err) { return done(err) }
        expect(childProcess.exec.calledWith('rmdir /tmp/how/.optimus_lock'))
          .to.be.true()
        done()
      })
    })

    it('should yield a Boom 500 error on failure', (done) => {
      const error = new Error('Unlock error')
      const path = '/path/to/unlock'
      childProcess.exec.yieldsAsync(error)
      cache.unlock(path, (err) => {
        expect(err.isBoom).to.be.true()
        expect(errorCat.wrap.calledWith(error, 500, 'cache.unlock'))
          .to.be.true()
        done()
      })
    })
  }) // end 'unlock'

  describe('usage', () => {
    it('should collect and tally cache disk usage', (done) => {
      const deployKeyUsage = '100\t' + process.env.DEPLOY_KEY_CACHE
      const repoUsage = '200\t' + process.env.REPOSITORY_CACHE
      const commitishUsage = '300\t' + process.env.COMMITISH_CACHE
      childProcess.exec
        .onFirstCall().yieldsAsync(null, deployKeyUsage)
        .onSecondCall().yieldsAsync(null, repoUsage)
        .onThirdCall().yieldsAsync(null, commitishUsage)
      cache.usage((err, bytes) => {
        if (err) { return done(err) }
        expect(bytes).to.equal(600)
        done()
      })
    })

    it('should gracefully handle errors', (done) => {
      const error = new Error('Something wicked')
      childProcess.exec.yieldsAsync(error)
      cache.usage((err) => {
        expect(err).to.equal(error)
        done()
      })
    })

    it('should log the usage call at `info`', (done) => {
      const deployKeyUsage = '100\t' + process.env.DEPLOY_KEY_CACHE
      const repoUsage = '200\t' + process.env.REPOSITORY_CACHE
      const commitishUsage = '300\t' + process.env.COMMITISH_CACHE
      childProcess.exec
        .onFirstCall().yieldsAsync(null, deployKeyUsage)
        .onSecondCall().yieldsAsync(null, repoUsage)
        .onThirdCall().yieldsAsync(null, commitishUsage)
      cache.usage((err) => {
        if (err) { return done(err) }
        expect(cache.log.info.calledWith(
          'Calculating cache disk usage'
        )).to.be.true()
        done()
      })
    })

    it('should log disk usage query errors at `error`', (done) => {
      const error = new Error('This way comes')
      childProcess.exec.yieldsAsync(error)
      cache.usage((err) => {
        expect(err).to.equal(error)
        expect(cache.log.error.calledWith(
          error, 'Unable to collect disk usage information'
        )).to.be.true()
        done()
      })
    })
  }) // end 'usage'

  describe('purge', () => {
    it('should purge cache directories', (done) => {
      const command = 'find $PATH -mindepth 1 -maxdepth 1 ' +
        '\\( -type d \'!\' -exec test -e "{}/.optimus.lock" \'\' \\) ' +
        '\\( -type d -amin +' + process.env.CACHE_PURGE_AGE + ' \\) ' +
        '-print | xargs rm -rf'
      cache.purge((err) => {
        if (err) { return done(err) }
        const cmd1 = command.replace('$PATH', process.env.DEPLOY_KEY_CACHE)
        expect(childProcess.exec.calledWith(cmd1)).to.be.true()
        const cmd2 = command.replace('$PATH', process.env.REPOSITORY_CACHE)
        expect(childProcess.exec.calledWith(cmd2)).to.be.true()
        const cmd3 = command.replace('$PATH', process.env.COMMITISH_CACHE)
        expect(childProcess.exec.calledWith(cmd3)).to.be.true()
        done()
      })
    })

    it('should handle file system errors', (done) => {
      const error = new Error('Party on Wayne.')
      childProcess.exec.yieldsAsync(error)
      cache.purge((err) => {
        expect(err).to.equal(error)
        done()
      })
    })

    it('should log purging at `info`', (done) => {
      cache.purge((err) => {
        if (err) { return done(err) }
        expect(cache.log.info.calledWith('Purging caches')).to.be.true()
        done()
      })
    })

    it('should log purge errors at `error`', (done) => {
      const error = new Error('Party on Garth.')
      childProcess.exec.yieldsAsync(error)
      cache.purge((err) => {
        expect(err).to.equal(error)
        expect(cache.log.error.calledWith(error, 'Purge failed')).to.be.true()
        done()
      })
    })
  }) // end 'purge'

  describe('setPurgeInterval', () => {
    var clock

    beforeEach((done) => {
      clock = sinon.useFakeTimers()
      sinon.spy(cache, 'purge')
      done()
    })

    afterEach((done) => {
      clock.restore()
      cache.clearPurgeInterval()
      cache.purge.restore()
      done()
    })

    it('should set the purge interval based on the environment', (done) => {
      cache.setPurgeInterval()
      clock.tick(process.env.CACHE_PURGE_INTERVAL)
      expect(cache.purge.calledOnce).to.be.true()
      done()
    })

    it('should not set an interval if one is already exists', (done) => {
      cache.setPurgeInterval()
      cache.setPurgeInterval()
      clock.tick(process.env.CACHE_PURGE_INTERVAL)
      expect(cache.purge.calledOnce).to.be.true()
      done()
    })
  }) // end 'setPurgeInterval'

  describe('clearPurgeInterval', () => {
    var clock

    beforeEach((done) => {
      clock = sinon.useFakeTimers()
      sinon.spy(cache, 'purge')
      cache.setPurgeInterval()
      done()
    })

    afterEach((done) => {
      clock.restore()
      cache.purge.restore()
      done()
    })

    it('should clear the interval', (done) => {
      cache.clearPurgeInterval()
      clock.tick(process.env.CACHE_PURGE_INTERVAL)
      expect(cache.purge.callCount).to.equal(0)
      done()
    })

    it('should ignore multiple clears', (done) => {
      cache.clearPurgeInterval()
      cache.clearPurgeInterval()
      cache.clearPurgeInterval()
      clock.tick(process.env.CACHE_PURGE_INTERVAL)
      expect(cache.purge.callCount).to.equal(0)
      done()
    })
  }) // end 'clearPurgeInterval'
}) // end 'cache'
