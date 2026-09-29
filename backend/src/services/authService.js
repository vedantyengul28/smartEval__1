const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database/db');
const config = require('../config');
const { BadRequestError, UnauthorizedError, ConflictError } = require('../utils/errors');
const { sanitizeUser } = require('../utils/helpers');

// Helper to promisify db operations
function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

async function register({ email, password, name, role }) {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await dbGet('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const id = uuidv4();

  await dbRun(
    `INSERT INTO users (id, name, email, password, role)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name.trim(), normalizedEmail, passwordHash, role]
  );

  const user = await dbGet(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
    [id]
  );

  const token = generateToken(user);

  return {
    user: sanitizeUser(user),
    token,
  };
}

async function login({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await dbGet(
    'SELECT id, name, email, password, role, created_at FROM users WHERE email = ?',
    [normalizedEmail]
  );

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await comparePassword(password, user.password);

  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = generateToken(user);

  return {
    user: sanitizeUser(user),
    token,
  };
}

async function getProfile(userId) {
  const user = await dbGet(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
    [userId]
  );
  
  if (!user) {
    throw new BadRequestError('User not found');
  }
  return sanitizeUser(user);
}

module.exports = {
  register,
  login,
  getProfile,
  hashPassword,
  comparePassword,
  generateToken,
};
