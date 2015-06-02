'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var after = lab.after;
var afterEach = lab.afterEach;
var Code = require('code');
var expect = Code.expect;
var sinon = require('sinon');
var rewire = require('rewire');
var noop = require('101/noop');

require('loadenv')('optimus:env');

describe('app', function() {
  var app;
  var middleware;

  beforeEach(function (done) {
    app = rewire('../../lib/app');
    sinon.stub(app.__get__('app'), 'use');
    sinon.stub(app.__get__('app'), 'put');
    app.__set__('middleware.bodyParser', { json: noop });
    middleware = app.__get__('middleware');
    sinon.spy(middleware, 'connectDatadog');
    sinon.spy(middleware, 'expressBoom');
    sinon.spy(middleware, 'notFound');
    sinon.spy(middleware, 'applyRules');
    sinon.spy(middleware.bodyParser, 'json');
    sinon.spy(middleware, 'logger');
    done();
  });

  afterEach(function (done) {
    app.__get__('app').use.restore();
    middleware.connectDatadog.restore();
    middleware.expressBoom.restore();
    middleware.applyRules.restore();
    middleware.notFound.restore();
    middleware.bodyParser.json.restore();
    middleware.logger.restore();
    done();
  });

  describe('interface', function() {
    it('should expose the `getInstance` method', function(done) {
      expect(app.getInstance).to.be.a.function();
      done();
    });
  }); // end 'interface'

  describe('getInstance', function() {
    it('should only initialize the application once', function(done) {
      expect(app.__get__('initialized')).to.be.false();
      var instance = app.getInstance();
      expect(app.__get__('initialized')).to.be.true();
      app.getInstance();
      expect(middleware.expressBoom.calledOnce).to.be.true();
      expect(middleware.bodyParser.json.calledOnce).to.be.true();
      expect(middleware.notFound.calledOnce).to.be.true();
      done();
    });

    it('should return the express application', function(done) {
      var instance = app.getInstance();
      expect(instance).to.equal(app.__get__('app'));
      expect(instance.listen).to.be.a.function();
      done();
    });

    it('should use express-boom for error generation', function(done) {
      var instance = app.getInstance();
      expect(middleware.expressBoom.calledOnce).to.be.true();
      var expressBoom = middleware.expressBoom.returnValues[0];
      expect(instance.use.calledWith(expressBoom)).to.be.true();
      done();
    });

    it('should use JSON body parser', function(done) {
      var instance = app.getInstance();
      expect(middleware.bodyParser.json.calledOnce).to.be.true();
      var bodyParserJSON = middleware.bodyParser.json.returnValues[0];
      expect(instance.use.calledWith(bodyParserJSON)).to.be.true();
      done();
    });

    it('should set the `PUT /` route', function(done) {
      var instance = app.getInstance();
      expect(middleware.applyRules.calledOnce).to.be.true();
      var applyRules = middleware.applyRules.returnValues[0];
      expect(instance.put.calledWith('/', applyRules)).to.be.true();
      done();
    });

    it('should set a 404 handler', function(done) {
      var instance = app.getInstance();
      expect(middleware.notFound.calledOnce).to.be.true();
      var notFound = middleware.notFound.returnValues[0];
      expect(instance.use.calledWith(notFound)).to.be.true();
      done();
    });

    it('should not use connect-datadog outside of production', function(done) {
      app.getInstance();
      expect(middleware.connectDatadog.callCount).to.equal(0);
      done();
    });

    it('should use connect-datadog in production', function(done) {
      var nodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      var instance = app.getInstance();
      expect(middleware.connectDatadog.calledOnce).to.be.true();
      var connectDatadog = middleware.connectDatadog.returnValues[0];
      expect(instance.use.calledWith(connectDatadog)).to.be.true();

      process.env.NODE_ENV = nodeEnv;
      done();
    });

    it('should use bunyan logging', function(done) {
      var instance = app.getInstance();
      expect(middleware.logger.calledOnce).to.be.true();
      var logger = middleware.logger.returnValues[0];
      expect(instance.use.calledWith(logger)).to.be.true();
      done();
    });
  }); // end 'getInstance'
}); // end 'app'
