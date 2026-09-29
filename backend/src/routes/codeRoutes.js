const express = require('express');
const codeController = require('../controllers/codeController');
const { authenticate } = require('../middleware/auth');
const { validateRequest, codeSchemas } = require('../utils/validators');

const router = express.Router();

router.post(
  '/submit',
  authenticate,
  validateRequest(codeSchemas.submit),
  codeController.submitCode
);

router.post('/run', authenticate, codeController.runSingleTestCase);

module.exports = router;
