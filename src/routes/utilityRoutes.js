const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const utilityController = require('../controllers/utilityController');
const { upload } = require('../services/s3');

// Utility routes
router.get('/profile', authenticate, authorize(['user', 'alim', 'admin']), utilityController.getProfile);
router.get('/settings', utilityController.getSettings);
router.post('/upload', authenticate, upload.single('file'), utilityController.uploadFile);
router.post('/contact', utilityController.contactForm);
router.post('/auth/renew-token', utilityController.renewToken);
router.post('/stripe/webhook', utilityController.stripeWebhook);
router.post('/paypal/webhook', utilityController.paypalWebhook);

module.exports = router;
