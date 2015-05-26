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

var OptimusClient = require('../../client');
var ApiClient = require('simple-api-client');

describe('client', function() {
  describe('interface', function() {
    it('should expose the optimus client', function(done) {
      expect(OptimusClient).to.be.a.function();
      expect(OptimusClient.prototype.transform).to.be.a.function();
      done();
    });

    it('should expose a static transform method', function(done) {
      expect(OptimusClient.transform).to.be.a.function();
      done();
    });
  }); // end 'interface'

  describe('constructor', function() {
    it('should use environment for default host', function(done) {
      process.env.OPTIMUS_HOST = 'http://optimus.com';
      delete process.env.OPTIMUS_PORT;
      var client = new OptimusClient();
      expect(client.host).to.equal('http://optimus.com:80');
      done();
    });

    it('should use given host override', function(done) {
      process.env.OPTIMUS_HOST = 'http://optimus.com';
      delete process.env.OPTIMUS_PORT;
      var client = new OptimusClient('http://wow.com');
      expect(client.host).to.equal('http://wow.com:80');
      done();
    });

    it('should use environment for default port', function(done) {
      process.env.OPTIMUS_HOST = 'http://optimus.com';
      process.env.OPTIMUS_PORT = '8989';
      var client = new OptimusClient();
      expect(client.host).to.equal('http://optimus.com:8989');
      done();
    });

    it('should use given port override', function(done) {
      var client = new OptimusClient('http://powza.com', '9000')
      expect(client.host).to.equal('http://powza.com:9000');
      done();
    });
  }); // end 'constructor'

  describe('transform', function() {
    it('should send a request to the correct route', function(done) {
      var client = new OptimusClient();
      sinon.stub(client, 'put').yieldsAsync();

      var repo = 'git@github.com:runnable/monitor-dog';
      var commitish = 'abcdef123456';
      var deployKey = 'deploy/key';
      var rules = [{ action: 'rename', source: 'foo', dest: 'bar' }];
      var opts = {
        repo: repo,
        commitish: commitish,
        deployKey: deployKey,
        rules: rules
      };

      client.transform(opts, function (err) {
        if (err) { return }

        var expectedPath = '?repo=' + encodeURIComponent(repo) +
          '&commitish=' + encodeURIComponent(commitish) +
          '&deployKey=' + encodeURIComponent(deployKey);

        expect(client.put.calledWith({
          path: expectedPath,
          body: rules,
          json: true
        })).to.be.true();

        done();
      });
    });
  }); // end 'transform'
}); // end 'client'
