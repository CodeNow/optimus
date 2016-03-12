'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const Code = require('code')
const expect = Code.expect
const sinon = require('sinon')

const app = require('../../lib/app')
const CriticalError = require('error-cat/errors/critical-error')

describe('unit', () => {
  describe('app', () => {
    describe('start', () => {
      it('should throw a crirical error if unable to start the server', (done) => {
        sinon.stub(app, 'getInstance').returns({
          listen: sinon.stub().yieldsAsync(new Error('booph'))
        })
        app.start().asCallback((err) => {
          expect(err).to.be.an.instanceof(CriticalError)
          done()
        })
        app.getInstance.restore()
      })
    }) // end 'start'
  }) // end 'app'
}) // end 'unit'
