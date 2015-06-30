'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var Code = require('code');
var expect = Code.expect;

require('loadenv')('optimus:env');
var util = require('util');
var fs = require('fs');
var app = require('../../lib/app');
var fixtureCache = require('../fixtures/fixture-cache');
var client = require('../../client');

describe('functional', function() {
  var server;

  before(function (done) {
    fixtureCache.create(function (err) {
      if (err) { return done(err); }
      server = app.getInstance().listen(process.env.PORT, done);
    });
  });

  after(function (done) {
    server.close(function (err) {
      if (err) { return done(err); }
      fixtureCache.destroy(done);
    });
  });

  describe('client', function() {
    it('should call the server to perform a transforms', function(done) {
      var options = {
        rules: [
          {
            action: 'replace',
            search: 'alpha',
            replace: 'iota'
          },
          {
            action: 'rename',
            source: 'README.md',
            dest: 'README'
          }
        ],
        repo: 'git@github.com:CodeNow/optimus-private-test',
        deployKey: 'optimus-private',
        commitish: 'f9394ecda04836b9453f113b37e93008c08822ee'
      };
      client.transform(options, function (err, resp) {
        if (err) { return done(err); }
        expect(resp.statusCode).to.equal(200);
        expect(resp.body.warnings).to.be.an.array();
        expect(resp.body.diff).to.be.a.string();
        expect(resp.body.results).to.be.an.array();
        done();
      });
    });

    it('should handle errors', function(done) {
      var options = {
        rules: [
          {
            action: 'replace',
            search: 'alpha',
            replace: 'iota'
          }
        ],
        repo: 'git@github.com:CodeNow/optimus-private-test',
        deployKey: 'invalid-key',
        commitish: 'f9394ecda04836b9453f113b37e93008c08822ee'
      };
      client.transform(options, function (err, resp) {
        if (err) { return done(err); }
        expect(resp.statusCode).to.equal(404);
        done();
      });
    });
  });
});
