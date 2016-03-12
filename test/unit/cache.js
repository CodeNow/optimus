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

const cache = require('../../lib/cache')
const cat = require('error-cat')
const childProcess = require('child_process')
const CriticalError = require('error-cat/errors/critical-error')
const Promise = require('bluebird')

describe('unit', () => {
  describe('cache', () => {
    describe('initialize', () => {
      it('should throw a CriticalError on failure', (done) => {
        sinon.stub(childProcess, 'execFileAsync', () => {
          return Promise.reject(new Error('noope'))
        })
        cache.initialize().asCallback((err) => {
          expect(err).to.be.an.instanceof(CriticalError)
          done()
        })
        childProcess.execFileAsync.restore()
      })
    }) // end 'initialize'

    describe('clearPurgeInterval', () => {
      it('should do nothing if there is no purge interval', (done) => {
        cache.purgeInterval = undefined
        cache.clearPurgeInterval()
        expect(cache.purgeInterval).to.equal(undefined)
        done()
      })

      it('should clear the set interval', (done) => {
        cache.purgeInterval = setInterval(function () {}, 10000)
        cache.clearPurgeInterval()
        expect(cache.purgeInterval).to.equal(null)
        done()
      })
    }) // end 'clearPurgeInterval'

    describe('purge', () => {
      beforeEach((done) => {
        sinon.stub(childProcess, 'execAsync').returns(Promise.resolve())
        sinon.stub(cat, 'report')
        done()
      })

      afterEach((done) => {
        childProcess.execAsync.restore()
        cat.report.restore()
        done()
      })

      it('should purge each cache path', (done) => {
        cache.purge().asCallback((err) => {
          expect(err).to.not.exist()
          cache.getCachePaths().forEach((path) => {
            expect(childProcess.execAsync.calledWith([
              // Find only direct children of the cache path
              'find ' + path + ' -mindepth 1 -maxdepth 1',
              // and only ones that do not contain a `.optimus.lock` file
              '\\( -type d \'!\' -exec test -e "{}/.optimus.lock" \'\' \\)',
              // and only ones that have not been accessed in the last 30 min
              '\\( -type d -amin +' + process.env.CACHE_PURGE_AGE + ' \\)',
              // Print the results and pass them through xargs to rm -rf
              '-print | xargs rm -rf'
            ].join(' '))).to.be.true()
          })
          done()
        })
      })

      it('should report errors', (done) => {
        childProcess.execAsync.restore()
        sinon.stub(childProcess, 'execAsync', () => {
          return Promise.reject(new Error('fool'))
        })
        cache.purge().asCallback((err) => {
          expect(err).to.not.exist()
          expect(cat.report.calledOnce).to.be.true()
          done()
        })
      })
    }) // end 'purge'
  }) // end 'cache'
}) // end 'unit'
