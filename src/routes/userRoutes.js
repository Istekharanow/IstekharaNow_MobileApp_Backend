const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const userController = require('../controllers/userController');

// User routes
router.get('/', authenticate, authorize(['admin']), userController.listUsers);
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);
// social auth routes for web
router.get('/auth/social', userController.getSocialAuthUrl);
router.get('/auth/decode-token', userController.decodeCognitoCode);
// social auth routes for mobile
router.post('/auth/social/mobile', userController.mobileSocialLogin);

module.exports = router;
