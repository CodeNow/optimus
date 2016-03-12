'use strict'

require('loadenv')('optimus:env')

const cat = require('error-cat')
const CriticalError = require('error-cat/errors/critical-error')
const envIs = require('101/env-is')
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
 * The optimus application.
 * @class
 * @author Ryan Sandor Richards
 */
class App {
  /**
   * Starts the optimus express server.
   * @return {Promise} Resolves when the server has started.
   */
  static start () {
    const log = logger.child({ method: 'start' })
    return Promise.resolve()
      .then(() => {
        const server = App.getInstance()
        return Promise.fromCallback(server.listen.bind(server, port))
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
  static getInstance () {
    const app = express()
    App.addMiddlewares(app)
    return app
  }

  /**
   * Adds middlewares to the given application.
   * @param {express} app Express application for which to add the optimus
   *   middlewares.
   */
  static addMiddlewares (app) {
    if (envIs('production')) {
      app.use(App.middleware.connectDatadog({
        'dogstatsd': monitor,
        'response_code': true,
        'method': true,
        'tags': [
          'name:optimus',
          'logType:express',
          `env: ${process.env.NODE_ENV}`
        ]
      }))
    }

    app.use(App.middleware.logger({ logger: logger }))
    app.use(App.middleware.bodyParser)
    app.put('/', App.middleware.applyRules)
    app.use(cat.middleware)
    app.use(App.middleware.notFound)
    app.use(App.middleware.errorResponder)
  }
}

/**
 * Optimus middlewares.
 * @type {Object}
 */
App.middleware = {
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
 * The optimus application module.
 * @module optimus:app
 */
module.exports = App
