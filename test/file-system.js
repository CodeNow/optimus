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
var childProcess = require('child_process');
var fileSystem = require('../lib/file-system');

describe('file-system', function() {
  beforeEach(function (done) {
    sinon.stub(childProcess, 'exec').yieldsAsync();
    done();
  });

  afterEach(function (done) {
    childProcess.exec.restore();
    done();
  });

  it('should expose the `setup` method', function(done) {
    expect(fileSystem.setup).to.be.a.function();
    done();
  });

  it('should create the required directories', function(done) {
    fileSystem.setup(function (err) {
      if (err) { return done(err); }
      expect(childProcess.exec.callCount).to.equal(2);
      var commandOne = 'mkdir -p ' + process.env.DEPLOY_KEY_PATH;
      expect(childProcess.exec.calledWith(commandOne)).to.be.true();
      var commandTwo = 'mkdir -p ' + process.env.REPOSITORY_PATH;
      expect(childProcess.exec.calledWith(commandTwo)).to.be.true();
      done();
    });
  });
});
