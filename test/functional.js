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

require('loadenv')('optimus:env');
var fs = require('fs');
var async = require('async');
var request = require('request');
var childProcess = require('child_process');
var cache = require('../lib/cache');
var deployKey = require('../lib/deploy-key');
var repository = require('../lib/repository');
var app = require('../lib/app');
var createCounter = require('callback-count');

var fixtureCache = require('./fixtures/fixture-cache');
var applicationRoot = require('app-root-path').toString();

describe('functional', function() {
  before(fixtureCache.create);
  after(fixtureCache.destroy);

  describe('deploy-key', function() {
    it('should fetch deploy keys from S3', function(done) {
      deployKey.fetch('mock/key', function (err) {
        if (err) { return done(err); }
        var keyPath = process.env.DEPLOY_KEY_CACHE + '/mock.key/ssh-key';
        var mockPath = applicationRoot + '/test/fixtures/mock-ssh-key';
        expect(fs.existsSync(keyPath)).to.be.true();
        var expectedContent = fs.readFileSync(mockPath).toString();
        var fetchedContent = fs.readFileSync(keyPath).toString();
        expect(expectedContent).to.equal(fetchedContent);
        done();
      });
    });

    it('should return an error if the deploy key was not found', function(done) {
      deployKey.fetch('/not/a/thing', function (err) {
        expect(err.code).to.equal('NoSuchKey');
        done();
      });
    });
  }); // end 'deploy-key'

  // NOTE: This is *not* a unit test, and must be run as a suite
  describe('repository', function() {
    var key = 'optimus-private';
    var keyPath;

    before(function (done) {
      deployKey.fetch(key, function (err, path) {
        keyPath = path;
        done()
      });
    });

    it('should clone a repository', function(done) {
      var repo = 'git@github.com:CodeNow/optimus-private-test';
      var commitish = '170bdd7672b75c4a51e394cf5217c97817321b32';
      repository.fetch(keyPath, repo, commitish, function (err, path) {
        if (err) { return done(err); }
        expect(fs.existsSync(path + '/A.txt')).to.be.true();
        expect(fs.existsSync(path + '/B.txt')).to.be.true();
        expect(fs.existsSync(path + '/C.txt')).to.be.false();
        expect(fs.existsSync(path + '/README.md')).to.be.true();
        done();
      });
    });

    it('should checkout a commitish of the same repo', function(done) {
      var repo = 'git@github.com:CodeNow/optimus-private-test';
      var commitish = '8dc308afc20330948e74d0b85c116572326ecee5';
      repository.fetch(keyPath, repo, commitish, function (err, path) {
        if (err) { return done(err); }
        expect(fs.existsSync(path + '/A.txt')).to.be.true();
        expect(fs.existsSync(path + '/B.txt')).to.be.true();
        expect(fs.existsSync(path + '/C.txt')).to.be.true();
        expect(fs.existsSync(path + '/README.md')).to.be.true();
        done();
      });
    });

    it('should check the cache for repositories and commitishes', function(done) {
      var repo = 'git@github.com:CodeNow/optimus-private-test';
      var commitish = '8dc308afc20330948e74d0b85c116572326ecee5';
      var spy = sinon.spy(fs.existsSync);
      repository.fetch(keyPath, repo, commitish, function (err, path) {
        expect(spy.calledWith(keyPath)).to.be.false();
        done();
      });
    });

    it('should yield an error if the SSH key is missing', function(done) {
      var repo = 'git@github.com:CodeNow/optimus-private-test';
      var commitish = 'adifferentcommitish';
      repository.fetch('bogus-/keyzz', repo, commitish, function (err, path) {
        expect(err).to.not.be.null();
        expect(path).to.be.undefined();
        done();
      });
    });
  }); // end 'repository'

  // NOTE: This is *not* a unit test, and must be run as a suite
  describe('PUT /', function() {
    var server;
    before(function (done) {
      server = app.listen(process.env.PORT, done);
    });

    after(function (done) {
      server.close(done);
    });

    it('should transform a repository', function(done) {
      var key = 'optimus-private';
      var repo = 'git@github.com:CodeNow/optimus-private-test';
      var commitish = '170bdd7672b75c4a51e394cf5217c97817321b32';

      var params = {
        url: 'http://127.0.0.1:' + process.env.PORT + '?' +
          'deployKey=' + encodeURIComponent(key) + '&' +
          'commitish=' + encodeURIComponent(commitish) + '&' +
          'repo=' + encodeURIComponent(repo),
        body: [
          {
            action: 'replace',
            search: 'beta',
            replace: 'omega'
          },
          {
            action: 'rename',
            source: 'B.txt',
            dest: 'W.txt'
          }
        ],
        json: true
      };

      request.put(params, function (err, response, body) {
        if (err) { return done(err); }
        var expectedKeys = ['warnings', 'diff', 'results', 'script'];
        expectedKeys.forEach(function (key) {
          expect(body[key]).to.exist();
        });
        done();
      });
    });

    it('should correctly handle multiple quick requests', function(done) {
      var key = 'optimus-private';
      var repo = 'git@github.com:CodeNow/optimus-private-test';
      var commitish = 'f9394ecda04836b9453f113b37e93008c08822ee';
      var url = 'http://127.0.0.1:' + process.env.PORT + '?' +
        'deployKey=' + encodeURIComponent(key) + '&' +
        'commitish=' + encodeURIComponent(commitish) + '&' +
        'repo=' + encodeURIComponent(repo);

      var bodyOne = [{ action: 'replace', search: 'beta', replace: 'omega' }];
      var bodyTwo = [{ action: 'rename', search: 'wow/D.txt', replace: 'D.txt' }];
      var bodyThree = [{ action: 'replace', search: 'alpha', replace: 'AAA' }];

      var counter = createCounter(3, done);

      request.put(
        {url: url, body: bodyOne, json: true},
        function (err, response, body) {
          if (err) { return done(err); }
          counter.next();
        }
      );

      request.put(
        {url: url, body: bodyTwo, json: true},
        function (err, response, body) {
          if (err) { return done(err); }
          counter.next();
        }
      );

      request.put(
        {url: url, body: bodyThree, json: true},
        function (err, response, body) {
          if (err) { return done(err); }
          counter.next();
        }
      );
    });
  }); // end 'PUT /'
}); // end 'functional'
