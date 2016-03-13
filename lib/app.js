'use strict'

require('loadenv')('optimus:env')

const cat = require('error-cat')
const CriticalError = require('error-cat/errors/critical-error')
const express = require('express')
const logger = require('./logger')
const monitor = require('monitor-dog')
const Promise = require('bluebird')
const RouteError = require('error-cat/errors/route-error')
const transform = require('./transform')

/**
 * Port on which optimus runs.
 * @type {number}
 */
const port = process.env.PORT

/**
 * Optimus middlewares.
 * @type {Object}
 */
const middlewares = {
  connectDatadog: require('connect-datadog'),
  bodyParser: require('body-parser').json(),
  logger: require('express-bunyan-logger'),
  applyRules: transform.applyRules,
  notFound: function (req, res, next) {
    next(new RouteError('Not Found', 404))
  },
  errorResponder: function (err, req, res, next) {
    let statusCode = err.isBoom ? err.output.statusCode : 500
    res.status(statusCode)
    res.send(err.message)
  }
}

/**
 * The optimus application.
 * @class
 * @author Ryan Sandor Richards
 */
class App {
  /**
   * Starts the optimus express server.
   * @return {Promise} Resolves when the server has started.
   */
  start () {
    const log = logger.child({ method: 'start' })
    const instance = this.getInstance()
    return Promise.resolve()
      .then(() => {
        return Promise.fromCallback((cb) => {
          const server = instance.listen(port, function (err) {
            if (err) { return cb(err) }
            log.info({ port: port }, 'Optimus server listening')
            cb(null, server)
          })
        })
      })
      .catch((err) => {
        const critical = new CriticalError('Unable to start server', {
          err: err,
          port: port
        })
        log.fatal({ err: critical }, critical.message)
        throw critical
      })
  }

  /**
   * Creates and returns an application instance for optimus.
   * @return {express} The express application for optimus.
   */
  getInstance () {
    const app = express()

    app.use(middlewares.connectDatadog({
      'dogstatsd': monitor,
      'response_code': true,
      'method': true,
      'tags': [
        'name:optimus',
        'logType:express',
        `env: ${process.env.NODE_ENV}`
      ]
    }))
    app.use(middlewares.logger({ logger: logger }))
    app.use(middlewares.bodyParser)
    app.put('/', middlewares.applyRules)
    app.use(cat.middleware)
    app.use((err, req, res, next) => {
      logger.error({ err: err }, err.message || 'An error occurred')
      next(err)
    })
    app.use(middlewares.notFound)
    app.use(middlewares.errorResponder)

    return app
  }
}

/**
 * The optimus application module.
 * @module optimus:app
 */
module.exports = new App()
