const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.error('JWT verification failed', {
        traceId: req.traceId || 'unknown',
        error: err.message,
        token: token.substring(0, 20) + '...',
        jwtSecret: process.env.JWT_SECRET ? 'loaded' : 'missing'
      });
      return res.status(403).json({
        error: 'Invalid token',
        traceId: req.traceId
      });
    }
    req.user = user;
    next();
  });
};

const authenticateAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticateToken, authenticateAdmin };