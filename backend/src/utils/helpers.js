function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function sendResponse(res, statusCode, data, message) {
  res.status(statusCode).json({
    status: 'success',
    message: message || null,
    data: data || null,
  });
}

function sendPagedResponse(res, statusCode, data, page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  res.status(statusCode).json({
    status: 'success',
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}

function uuidv4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function parseNumber(str, fallback = null) {
  const n = parseInt(str, 10);
  return isNaN(n) ? fallback : n;
}

function calculatePercentage(awarded, max) {
  if (!max || max === 0) return 0;
  return Math.round(((awarded / max) * 10000)) / 100;
}

function assignGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

module.exports = {
  asyncHandler,
  sendResponse,
  sendPagedResponse,
  uuidv4,
  parseNumber,
  calculatePercentage,
  assignGrade,
  sanitizeUser,
  chunkArray,
};
