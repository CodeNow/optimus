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
const noop = require('101/noop')

require('loadenv')('optimus:env')

const App = require('../../lib/app')
const Boom = require('boom')

describe('app', () => {
  describe('getInstance', () => {
    beforeEach((done) => {
      sinon.stub(App, 'addMiddlewares')
      done()
    })

    afterEach((done) => {
      App.addMiddlewares.restore()
      done()
    })

    it('should return an express application', (done) => {
      expect(App.getInstance()).to.exist()
      expect(App.getInstance().put).to.be.a.function()
      expect(App.getInstance().use).to.be.a.function()
      done()
    })

    it('should add middlewares to the application', (done) => {
      const app = App.getInstance()
      expect(App.addMiddlewares.calledOnce).to.be.true()
      expect(App.addMiddlewares.calledWith(app)).to.be.true()
      done()
    })
  }) // end 'getInstance'

  describe('addMiddlewares', () => {
    const mock = {
      app: {
        put: noop,
        use: noop
      },
      middleware: {
        connectDatadog: 'datadawgz',
        logger: 'loggaz'
      }
    }

    beforeEach((done) => {
      sinon.stub(App.middleware, 'connectDatadog')
        .returns(mock.middleware.connectDatadog)
      sinon.stub(App.middleware, 'logger')
        .returns(mock.middleware.logger)
      sinon.stub(mock.app, 'put')
      sinon.stub(mock.app, 'use')
      App.addMiddlewares(mock.app)
      done()
    })

    afterEach((done) => {
      App.middleware.connectDatadog.restore()
      App.middleware.logger.restore()
      mock.app.put.restore()
      mock.app.use.restore()
      done()
    })

    it('should add the logger middleware', (done) => {
      expect(mock.app.use.calledWith(mock.middleware.logger)).to.be.true()
      done()
    })

    it('should add the JSON body parser middleware', (done) => {
      expect(mock.app.use.calledWith(App.middleware.bodyParser)).to.be.true()
      done()
    })

    it('should add the applyRules middleware', (done) => {
      expect(mock.app.put.calledWith('/', App.middleware.applyRules))
        .to.be.true()
      done()
    })

    it('should add the notFound middleware', (done) => {
      expect(mock.app.use.calledWith(App.middleware.notFound)).to.be.true()
      done()
    })

    it('should add the error middleware', (done) => {
      expect(mock.app.use.calledWith(App.middleware.error)).to.be.true()
      done()
    })

    it('should not add the datadog middleware', (done) => {
      expect(mock.app.use.calledWith(mock.middleware.connectDatadog))
        .to.be.false()
      done()
    })

    describe('in production', () => {
      var previousEnv

      beforeEach((done) => {
        previousEnv = process.env.NODE_ENV
        process.env.NODE_ENV = 'production'
        App.addMiddlewares(mock.app)
        done()
      })

      afterEach((done) => {
        process.env.NODE_ENV = previousEnv
        done()
      })

      it('should add the datadog middleware', (done) => {
        expect(mock.app.use.calledWith(mock.middleware.connectDatadog))
          .to.be.true()
        done()
      })
    }) // end 'in production'
  }) // end 'addMiddlewares'

  describe('middleware', () => {
    const mock = { notFound: 'not-found-error' }

    beforeEach((done) => {
      sinon.stub(Boom, 'notFound').returns(mock.notFound)
      done()
    })

    afterEach((done) => {
      Boom.notFound.restore()
      done()
    })

    describe('notFound', () => {
      it('should pass a boom not-found to the `next` callback', (done) => {
        App.middleware.notFound(null, null, (value) => {
          expect(value).to.equal(mock.notFound)
          done()
        })
      })
    }) // end 'notFound'
  }) // end 'middleware'
}) // end 'app'
