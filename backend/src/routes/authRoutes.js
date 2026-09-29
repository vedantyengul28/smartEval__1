const express = require('express');
const authController = require('../controllers/authController');
const { validateRequest, authSchemas } = require('../utils/validators');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', validateRequest(authSchemas.register), authController.register);
router.post('/login', validateRequest(authSchemas.login), authController.login);
router.post('/logout', authController.logout);
router.get('/profile', authenticate, authController.profile);

module.exports = router;
