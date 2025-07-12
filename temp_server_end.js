
// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info('Claude to Todoist API service started', {
      port: config.port,
      environment: config.nodeEnv,
      version: config.version,
      healthCheck: `http://localhost:${config.port}/health`,
      info: `http://localhost:${config.port}/info`,
      trustedProxies: config.trustedProxies || 'none',
      corsOrigin: config.corsOrigin
    });
  });

  // Handle server errors
  server.on('error', (error) => {
    logger.error('Server error', error);
    process.exit(1);
  });

  // Graceful shutdown
  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Export ONLY the app for testing
module.exports = app;
