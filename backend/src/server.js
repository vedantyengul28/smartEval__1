const createApp = require('./app');
const config = require('./config');
const { testConnection, closeDatabase } = require('../database/db');
const redis = require('./config/redis');

const app = createApp();

async function startServer() {
  console.log('========================================');
  console.log('  SmartEval Backend Server Starting');
  console.log('========================================');
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Port:        ${config.port}`);

  testConnection();

  // Initialize Redis connection
  try {
    await redis.connect();
    await redis.testConnection();
    console.log('✓ Redis connected');
  } catch (err) {
    console.warn('⚠ Redis connection failed, caching disabled:', err.message);
  }

  const server = app.listen(config.port, () => {
    console.log(`\n🚀 Server running on http://localhost:${config.port}`);
    console.log(`📊 Health check: http://localhost:${config.port}/api/health`);
    console.log(`\nPress Ctrl+C to stop the server`);
  });

  const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];
  const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close((err) => {
      if (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
      console.log('HTTP server closed');
      try {
        closeDatabase();
        console.log('Database connection closed');
      } catch (e) {
        console.error('Error closing connections:', e.message);
      }
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Forced shutdown after 10s');
      process.exit(1);
    }, 10000);
  };

  shutdownSignals.forEach((sig) => {
    process.on(sig, () => gracefulShutdown(sig));
  });

  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
    process.exit(1);
  });

  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { startServer, createApp };
