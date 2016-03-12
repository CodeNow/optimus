'use strict'

require('loadenv')('optimus:env')

const app = require('./lib/app')
const cache = require('./lib/cache')
const cat = require('error-cat')
const monitor = require('monitor-dog')

cache.initialize()
  .then(app.start)
  .then(() => { monitor.histogram('status', 1) })
  .catch(cat.catch)
  .catch(() => {
    monitor.histogram('status', 0)
    process.exit(1)
  })
