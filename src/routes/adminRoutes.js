const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Admin routes
router.post('/', adminController.createAdmin);
router.post('/login', adminController.login);
router.post('/forgot-password', adminController.forgotPassword);
router.post('/reset-password', adminController.resetPassword);
router.get('/overview', authenticate, authorize(['admin']), adminController.getOverview);

module.exports = router;
