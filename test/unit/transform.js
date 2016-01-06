'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var Code = require('code');
var expect = Code.expect;
var sinon = require('sinon');

require('loadenv')('optimus:env');
var Transformer = require('fs-transform');
var monitor = require('monitor-dog');
var transform = require('../../lib/transform');
var repository = require('../../lib/repository');
var MockResponse = require('../fixtures/mock-response');
var deployKey = require('../../lib/deploy-key');
var cache = require('../../lib/cache');
var errorCat = require('../../lib/error');

describe('transform', function() {
  var validRepo = 'git@github.com:org/repo';
  var rootPath = '/tmp/example';
  var response = new MockResponse();

  var deployKeyFetchTimer = { stop: function() {} };
  var fetchTimer = { stop: function() {} };
  var transformTimer = { stop: function() {} };
  var sshKeyPath = '/some/path/ssh-key';

  var transformer = {
    warnings: ['A warning', 'Another warning'],
    getDiff: function() { return 'woot'; },
    getScript: function() { return 'sauce'; }
  };

  var request = {
    query: {
      repo: validRepo,
      commitish: 'commitish',
      deployKey: '/deploy/key/path'
    },
    body: [
      { action: 'rename', source: 'A', dest: 'B' },
      { action: 'replace', search: 'foo', replace: 'bar' }
    ]
  };

  beforeEach(function (done) {
    sinon.stub(deployKey, 'fetch').yieldsAsync(null, sshKeyPath);
    sinon.stub(repository, 'fetch').yieldsAsync(null, rootPath);
    sinon.stub(Transformer, 'dry').yieldsAsync(null, transformer);
    sinon.stub(monitor, 'timer')
      .onFirstCall().returns(deployKeyFetchTimer)
      .onSecondCall().returns(fetchTimer)
      .onThirdCall().returns(transformTimer);
    sinon.spy(fetchTimer, 'stop');
    sinon.spy(transformTimer, 'stop');
    sinon.spy(deployKeyFetchTimer, 'stop');
    sinon.stub(cache, 'unlock').yieldsAsync();
    sinon.spy(errorCat, 'create');
    done();
  });

  afterEach(function (done) {
    deployKey.fetch.restore();
    repository.fetch.restore();
    Transformer.dry.restore();
    monitor.timer.restore();
    fetchTimer.stop.restore();
    transformTimer.stop.restore();
    deployKeyFetchTimer.stop.restore();
    cache.unlock.restore();
    errorCat.create.restore();
    done();
  });

  describe('interface', function() {
    it('should expose the applyRules method', function(done) {
      expect(transform.applyRules).to.be.a.function();
      done();
    });
  }); // end 'interface'

  describe('validations', function() {
    it('should respond 400 if repository is missing', function(done) {
      var req = {
        query: { commitish: 'commitish', deployKey: '/some/path' },
        body: []
      };
      transform.applyRules(req, response, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(errorCat.create.calledOnce).to.be.true();
        expect(errorCat.create.calledWith(
          400, 'Parameter `repo` is required.'
        )).to.be.true();
        done();
      });
    });

    it('should respond 400 if the repository is malformed', function(done) {
      var req = {
        query: {
          commitish: 'commitish',
          deployKey: '/some/path',
          repo: 'pzzzklskd,d,---s'
        },
        body: []
      };
      transform.applyRules(req, response, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(errorCat.create.calledOnce).to.be.true();
        expect(errorCat.create.calledWith(
          400,
          'Parameter `repo` is not in the form: ' +
          'git@github.com:Organization/Repository'
        )).to.be.true();
        done();
      });
    });

    it('should respond 400 if commitish is missing', function(done) {
      var req = {
        query: { repo: validRepo, deployKey: '/some/path' },
        body: []
      };
      transform.applyRules(req, response, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(errorCat.create.calledOnce).to.be.true();
        expect(errorCat.create.calledWith(
          400, 'Parameter `commitish` is required.'
        )).to.be.true();
        done();
      });
    });

    it('should respond 400 if the deploy key is missing', function(done) {
      var req = {
        query: { repo: validRepo, commitish: 'commitish' },
        body: []
      };
      transform.applyRules(req, response, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(errorCat.create.calledOnce).to.be.true();
        expect(errorCat.create.calledWith(
          400, 'Parameter `deployKey` is required.'
        )).to.be.true();
        done();
      });
    });

    it('should respond 400 if the body is not an array of rules', function(done) {
      var req = {
        query: {
          repo: validRepo,
          commitish: 'commitish',
          deployKey: '/some/path'
        }
      };
      transform.applyRules(req, response, function (err) {
        expect(err).to.exist();
        expect(err.isBoom).to.be.true();
        expect(errorCat.create.calledOnce).to.be.true();
        expect(errorCat.create.calledWith(
          400, 'Body must be an array of transform rules.'
        )).to.be.true();
        done();
      });
    });
  }); // end 'validations'

  describe('applyRules', function() {
    it('should fetch the deploy key', function(done) {
      response.once('json', function () {
        expect(deployKey.fetch.calledOnce).to.be.true();
        expect(deployKey.fetch.calledWith(request.query.deployKey))
          .to.be.true();
        done();
      });
      transform.applyRules(request, response);
    });

    it('should time the deploy key fetch', function (done) {
      response.once('json', function () {
        expect(monitor.timer.calledWith('key.time')).to.be.true();
        expect(deployKeyFetchTimer.stop.calledOnce).to.be.true();
        done();
      });
      transform.applyRules(request, response);
    });

    it('should fetch the repository', function(done) {
      response.once('json', function () {
        expect(repository.fetch.calledOnce).to.be.true();

        expect(repository.fetch.calledWith(
          sshKeyPath, // Yielded from deployKey.fetch
          request.query.repo,
          request.query.commitish
        )).to.be.true();
        done();
      });
      transform.applyRules(request, response);
    });

    it('should time the repository fetch', function(done) {
      response.once('json', function () {
        expect(monitor.timer.calledWith('repository.time')).to.be.true();
        expect(fetchTimer.stop.calledOnce).to.be.true();
        done();
      });
      transform.applyRules(request, response);
    });

    it('should apply given transformations', function (done) {
      response.once('json', function () {
        expect(Transformer.dry.calledOnce).to.be.true();
        expect(Transformer.dry.calledWith(rootPath, request.body)).to.be.true();
        done();
      });
      transform.applyRules(request, response);
    });

    it('should time the application of transformations', function(done) {
      response.once('json', function () {
        expect(monitor.timer.calledWith('transform.time')).to.be.true();
        expect(transformTimer.stop.calledOnce).to.be.true();
        done();
      });
      transform.applyRules(request, response);
    });

    it('should yield transformation errors', function(done) {
      var error = new Error('howdydoody');
      Transformer.dry.yieldsAsync(error);
      transform.applyRules(request, response, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });

    it('should unlock the commitish directory', function(done) {
      response.once('json', function () {
        expect(cache.unlock.calledWith(rootPath)).to.be.true();
        done();
      });
      transform.applyRules(request, response);
    });

    it('should yield unlock errors', function(done) {
      var error = new Error('teenagemutantninjaturtles');
      cache.unlock.yieldsAsync(error);
      transform.applyRules(request, response, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });

    it('should respond with the correct data', function(done) {
      response.once('json', function (object) {
        expect(object.warnings).to.deep.equal(transformer.warnings);
        expect(object.diff).to.equal(transformer.getDiff());
        expect(object.script).to.equal(transformer.getScript());
        done();
      });
      transform.applyRules(request, response);
    });

    it('should yield repository fetch errors', function(done) {
      var error = new Error('Fetch error');
      repository.fetch.yields(error);
      transform.applyRules(request, response, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });

    it('should yield transformation errors', function(done) {
      var error = new Error('Transform error');
      Transformer.dry.yields(error);
      transform.applyRules(request, response, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });
});
