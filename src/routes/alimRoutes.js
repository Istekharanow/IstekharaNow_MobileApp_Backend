const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const alimController = require('../controllers/alimController');

// Alim routes
router.get('/', authenticate, authorize(['admin']), alimController.listAlims);
router.post('/', authenticate, authorize(['admin']), alimController.createAlim);
router.post('/login', alimController.login);
router.post('/forgot-password', alimController.forgotPassword);
router.post('/reset-password', alimController.resetPassword);

module.exports = router;
