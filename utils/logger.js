const { v4: uuidv4 } = require('uuid');

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
    }

    generateTraceId() {
        return uuidv4();
    }

    formatMessage(level, traceId, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            traceId,
            message,
            ...meta
        };
        return JSON.stringify(logEntry);
    }

    log(level, message, meta = {}) {
        if (this.shouldLog(level)) {
            const traceId = meta.traceId || this.generateTraceId();
            console.log(this.formatMessage(level, traceId, message, meta));
            return traceId;
        }
    }

    info(message, meta = {}) {
        return this.log('info', message, meta);
    }

    error(message, meta = {}) {
        return this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        return this.log('warn', message, meta);
    }

    debug(message, meta = {}) {
        return this.log('debug', message, meta);
    }

    shouldLog(level) {
        const levels = ['error', 'warn', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.logLevel.toLowerCase());
        const messageLevelIndex = levels.indexOf(level.toLowerCase());
        return messageLevelIndex <= currentLevelIndex;
    }

    // Request logging middleware
    requestLogger() {
        return (req, res, next) => {
            const traceId = this.generateTraceId();
            const startTime = Date.now();
            
            // Add traceId to request object
            req.traceId = traceId;
            
            // Log incoming request
            this.info('Incoming request', {
                traceId,
                method: req.method,
                url: req.url,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
            });

            // Override res.json to log response
            const originalJson = res.json;
            res.json = function(data) {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                
                logger.info('Outgoing response', {
                    traceId,
                    statusCode: res.statusCode,
                    responseTime: `${responseTime}ms`,
                    responseSize: JSON.stringify(data).length
                });

                return originalJson.call(this, data);
            };

            next();
        };
    }

    // Error logging middleware
    errorLogger() {
        return (err, req, res, next) => {
            this.error('Request error', {
                traceId: req.traceId,
                error: err.message,
                stack: err.stack,
                method: req.method,
                url: req.url,
                ip: req.ip || req.connection.remoteAddress
            });

            res.status(500).json({
                error: 'Internal server error',
                traceId: req.traceId
            });
        };
    }
}

// Create a singleton instance
const logger = new Logger();

// Export both the instance and class for testing
module.exports = logger;
module.exports.Logger = Logger;