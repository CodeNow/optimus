'use strict'

require('loadenv')('optimus:env')

const app = require('./lib/app')
const cache = require('./lib/cache')
const cat = require('error-cat')
const monitor = require('monitor-dog')
const log = require('./lib/logger').child({ module: 'index' })

cache.initialize()
  .then(app.start)
  .then(() => { monitor.histogram('status', 1) })
  .catch(cat.catch)
  .catch((err) => {
    log.fatal({ err: err }, 'Optimus failed to start')
    monitor.histogram('status', 0)
    process.exit(1)
  })
