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
  });


});
