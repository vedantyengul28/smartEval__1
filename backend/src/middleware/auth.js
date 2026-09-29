const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../../database/db');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');

// Helper to promisify db operations
function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function authenticate(req, res, next) {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required. Please login.');
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await dbGet(
      'SELECT id, email, name, role, created_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      throw new UnauthorizedError('User no longer exists');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Session expired. Please login again.'));
    } else if (err instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid authentication token.'));
    } else {
      next(err);
    }
  }
}

function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. This action requires ${allowedRoles.join(' or ')} role.`
        )
      );
    }
    next();
  };
}

const requireTeacher = requireRole('teacher');
const requireStudent = requireRole('student');
const requireAny = requireRole(['teacher', 'student']);

module.exports = {
  authenticate: asyncHandler(authenticate),
  requireRole,
  requireTeacher,
  requireStudent,
  requireAny,
};
