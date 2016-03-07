'use strict'

require('loadenv')('optimus:env')
const express = require('express')
const monitor = require('monitor-dog')
const envIs = require('101/env-is')
const Boom = require('boom')
const transform = require('./transform')
const logger = require('./logger')
const error = require('./error')

/**
 * The optimus application.
 * @class
 * @author Ryan Sandor Richards
 */
class App {
  /**
   * Creates and returns an application instance for optimus.
   * @return {express} The express application for optimus.
   */
  static getInstance () {
    let app = express()
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
    app.use(App.middleware.notFound)
    app.use(App.middleware.error)
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
    next(Boom.notFound())
  },
  error: error.respond
}

/**
 * The optimus application module.
 * @module optimus:app
 */
module.exports = App
