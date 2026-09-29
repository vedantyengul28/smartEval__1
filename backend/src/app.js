const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const questionRoutes = require('./routes/questionRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const codeRoutes = require('./routes/codeRoutes');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: config.nodeEnv === 'production',
      crossOriginEmbedderPolicy: false,
    })
  );

  const allowedOrigins = config.cors.origin.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || config.nodeEnv === 'development') return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Disposition'],
      maxAge: 86400,
    })
  );

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  if (config.nodeEnv !== 'test') {
    app.use(
      morgan(config.nodeEnv === 'production' ? 'combined' : 'dev', {
        skip: (req) => req.path === '/api/health',
      })
    );
  }

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'fail',
      message: 'Too many requests, please try again later.',
    },
  });
  app.use('/api/', limiter);

  const uploadsPath = path.resolve(config.uploads.dir);
  app.use('/uploads', express.static(uploadsPath, { maxAge: '1h' }));

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'SmartEval Backend API is healthy',
      data: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        version: process.env.npm_package_version || '1.0.0',
      },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/assessments', assessmentRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/submissions', submissionRoutes);
  app.use('/api/code', codeRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
