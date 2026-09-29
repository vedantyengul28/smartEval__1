const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { BadRequestError } = require('../utils/errors');

const uploadDir = path.resolve(config.uploads.dir);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`[Uploads] Created upload directory: ${uploadDir}`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const studentDir = path.join(uploadDir, req.user ? req.user.id : 'anonymous');
    if (!fs.existsSync(studentDir)) {
      fs.mkdirSync(studentDir, { recursive: true });
    }
    cb(null, studentDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${timestamp}_${random}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  const allowed = config.uploads.allowedTypes.map((t) => t.toLowerCase());

  const mimeTypeAllowed =
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'application/pdf';

  const extAllowed = allowed.includes(ext);

  if (mimeTypeAllowed && extAllowed) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`Invalid file type. Allowed: ${allowed.join(', ')}`));
  }
}

const upload = multer({
  storage,
  limits: {
    fileSize: config.uploads.maxFileSize,
  },
  fileFilter,
});

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMB = Math.round(config.uploads.maxFileSize / (1024 * 1024));
      return next(new BadRequestError(`File too large. Maximum size: ${maxMB}MB`));
    }
    return next(new BadRequestError(`File upload error: ${err.message}`));
  }
  next(err);
}

function getUploadPublicPath(fullPath) {
  const relative = path.relative(uploadDir, fullPath);
  return relative ? path.join('/uploads', relative).replace(/\\/g, '/') : null;
}

function resolvePublicPath(publicPath) {
  if (!publicPath) return null;
  const rel = publicPath.replace(/^\/uploads\//, '');
  return path.join(uploadDir, rel);
}

module.exports = {
  upload,
  handleMulterError,
  uploadDir,
  getUploadPublicPath,
  resolvePublicPath,
};
