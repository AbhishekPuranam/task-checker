const jwt = require('jsonwebtoken');
const fs = require('fs');

const JWT_SECRET = fs.existsSync('/run/secrets/jwt_secret')
  ? fs.readFileSync('/run/secrets/jwt_secret', 'utf8').trim()
  : process.env.JWT_SECRET || 'default-secret-change-in-production';

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

module.exports = { auth };
