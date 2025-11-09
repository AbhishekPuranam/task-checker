/**
 * Structured Logging Utility with OpenSearch Support
 * 
 * This module provides Winston-based structured logging compatible with OpenSearch.
 * It replaces console.log statements with proper log levels and structured metadata.
 * 
 * Log Levels:
 * - error: Critical failures requiring immediate attention
 * - warn: Potential issues that don't stop execution
 * - info: General application events (default for production)
 * - debug: Detailed debugging information (development only)
 * - verbose: Extremely detailed logs (rarely used)
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists - use /app/logs for Docker, or relative path for local
const logsDir = fs.existsSync('/app/logs') ? '/app/logs' : path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * OpenSearch-compatible structured format
 */
const opensearchFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Human-readable console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, category, ...metadata }) => {
    let msg = `${timestamp} [${service || 'app'}]`;
    if (category) msg += ` [${category}]`;
    msg += ` ${level}: ${message}`;
    
    const metaKeys = Object.keys(metadata);
    if (metaKeys.length > 0 && metaKeys[0] !== Symbol.for('splat')) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

/**
 * Create transports based on environment
 */
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? opensearchFormat : consoleFormat,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  })
);

// File transports for production
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: opensearchFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: opensearchFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true,
    })
  );
}

/**
 * Create the logger instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: opensearchFormat,
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'backend-api',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  transports,
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      format: opensearchFormat,
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      format: opensearchFormat,
    })
  ],
  exitOnError: false,
});

/**
 * Helper: Log HTTP request
 */
logger.logRequest = (req, metadata = {}) => {
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    category: 'http',
    ...metadata
  });
};

/**
 * Helper: Log HTTP response
 */
logger.logResponse = (req, res, duration, metadata = {}) => {
  const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
  
  logger.log(level, 'HTTP Response', {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration,
    userId: req.user?.id,
    category: 'http',
    ...metadata
  });
};

/**
 * Helper: Log error with context
 */
logger.logError = (error, context = {}) => {
  logger.error(error.message || 'Unknown error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    category: 'error',
    ...context
  });
};

/**
 * Helper: Log job processing events
 */
logger.logJob = (event, jobId, metadata = {}) => {
  const levelMap = {
    started: 'info',
    progress: 'debug',
    completed: 'info',
    failed: 'error',
  };
  
  logger.log(levelMap[event] || 'info', `Job ${event}`, {
    jobId,
    event,
    category: 'job-processing',
    ...metadata
  });
};

/**
 * Helper: Log database operations
 */
logger.logDatabase = (operation, collection, metadata = {}) => {
  logger.debug('Database operation', {
    operation,
    collection,
    category: 'database',
    ...metadata
  });
};

/**
 * Helper: Log authentication events
 */
logger.logAuth = (event, userId, metadata = {}) => {
  logger.info(`Auth: ${event}`, {
    event,
    userId,
    category: 'authentication',
    ...metadata
  });
};

/**
 * Helper: Log worker events
 */
logger.logWorker = (workerName, event, metadata = {}) => {
  logger.info(`Worker ${event}`, {
    worker: workerName,
    event,
    category: 'worker',
    ...metadata
  });
};

/**
 * Helper: Log cache operations
 */
logger.logCache = (operation, key, metadata = {}) => {
  logger.debug('Cache operation', {
    operation,
    key,
    category: 'cache',
    ...metadata
  });
};

/**
 * Middleware: Log all HTTP requests and responses
 */
logger.httpMiddleware = () => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Log request
    if (req.path !== '/health' && req.path !== '/api/health') {
      logger.logRequest(req);
    }
    
    // Capture response
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;
      
      // Log slow requests as warnings
      if (duration > 1000 && req.path !== '/health') {
        logger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          duration,
          category: 'performance',
        });
      }
      
      // Log response
      if (req.path !== '/health' && req.path !== '/api/health') {
        logger.logResponse(req, res, duration);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Stream for Morgan HTTP logger (if needed)
 */
logger.stream = {
  write: (message) => {
    logger.info(message.trim(), { category: 'http' });
  }
};

module.exports = logger;
