import timeout from 'express-timeout-handler'

import statsd from '../lib/statsd.js'

// Heroku router requests timeout after 30 seconds. We should stop them earlier!
const maxRequestTimeout = parseInt(process.env.REQUEST_TIMEOUT, 10) || 10000

export default timeout.handler({
  // Default timeout for all endpoints
  // To override for a given router/endpoint, use `xExpressTimeoutHandler.set(...)`
  timeout: maxRequestTimeout,

  // IMPORTANT:
  // We cannot allow the middleware to disable the `res` object's methods like
  // it does by default if we want to use `next` in the `onTimeout` handler!
  disable: [],

  onTimeout: function (req, res, next) {
    const incrementTags = []
    // Be careful with depending on attributes set on the `req` because
    // under certain conditions the contextualizers might not yet have
    // had a chance to run.
    if (req.pagePath) {
      incrementTags.push(`path:${req.pagePath}`)
    }
    if (req.context?.currentCategory) {
      incrementTags.push(`product:${req.context.currentCategory}`)
    }
    statsd.increment('middleware.timeout', 1, incrementTags)

    // Create a custom timeout error
    const timeoutError = new Error('Request timed out')
    timeoutError.statusCode = 503
    timeoutError.code = 'ETIMEDOUT'

    // Pass the error to our Express error handler for consolidated processing
    return next(timeoutError)
  },

  // Can also set an `onDelayedResponse` property IF AND ONLY IF you allow for disabling methods
})
