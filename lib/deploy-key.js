'use strict';

require('loadenv')('optimus:env');
var monitor = require('monitor-dog');
var AWS = require('aws-sdk');
var fs = require('fs');
var path = require('path');

/**
 * Fetches runnable deploy keys.
 * @module optimus:deploy-key
 * @author Ryan Sandor Richards
 */
module.exports = { fetch: fetch };

/**
 * Fetches runnable deploy keys from S3 and caches them on the local filesystem.
 * @param keyPath Path of the key to fetch and store.
 * @param {optimus:deploy-key~FetchCallback} cb Callback to execute after the
 *   deploy key has been fetched.
 */
function fetch(keyPath, cb) {
  var s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  });
  var params = {
    Bucket: process.env.S3_DEPLOY_KEY_BUCKET,
    Key: keyPath
  };

  if (keyPath.charAt(0) == '/') {
    keyPath = keyPath.slice(1);
  }

  var destPath = path.resolve(process.env.DEPLOY_KEY_PATH, keyPath);

  s3.getObject(params)
    .createReadStream()
    .pipe(fs.createWriteStream(destPath))
    .on('error', cb)
    .on('end', cb);
}

/**
 * Called after a deploy key has been fetched.
 * @callback optimus:deploy-key~FetchCallback
 * @param {Error} [err] Error, if one occurred during the deploy key fetch.
 */
