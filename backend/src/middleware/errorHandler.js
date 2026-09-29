const config = require('../config');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let status = err.status || 'error';
  let details = err.details || null;
  let stack = null;

  if (config.nodeEnv === 'development') {
    stack = err.stack;
  }

  if (!err.isOperational) {
    if (config.nodeEnv === 'production') {
      message = 'Something went wrong on our end';
      statusCode = 500;
      details = null;
    }
  }

  if (err.code === 'ECONNREFUSED') {
    message = 'Unable to connect to a required service';
    statusCode = 503;
    status = 'error';
  }

  if (err.code === '23505') {
    message = 'A record with this information already exists';
    statusCode = 409;
    status = 'fail';
  }

  if (err.code === '23503') {
    message = 'Referenced record does not exist';
    statusCode = 400;
    status = 'fail';
  }

  if (err.name === 'TokenExpiredError') {
    message = 'Session expired. Please login again.';
    statusCode = 401;
    status = 'fail';
  }

  if (config.nodeEnv === 'development') {
    console.error('[ERROR]', err);
  } else if (statusCode >= 500) {
    console.error('[ERROR]', {
      message: err.message,
      stack: err.stack,
      statusCode,
      path: req.path,
      method: req.method,
      user: req.user ? req.user.id : 'unauthenticated',
    });
  }

  res.status(statusCode).json({
    status,
    message,
    details,
    ...(config.nodeEnv === 'development' && { stack }),
  });
}

function notFoundHandler(req, res, next) {
  res.status(404).json({
    status: 'fail',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
