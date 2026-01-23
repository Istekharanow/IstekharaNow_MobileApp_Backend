const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const istekharaController = require('../controllers/istekharaController');

// Istekhara routes
router.get('/', authenticate, authorize(['user', 'alim']), istekharaController.listIstekharas);
router.post('/', authenticate, authorize(['user', 'alim']), istekharaController.createIstekhara);
router.get('/:request_id', authenticate, authorize(['user', 'alim']), istekharaController.getIstekhara);
router.post('/:request_id/reply', authenticate, authorize(['alim']), istekharaController.sendReply);
router.get('/:request_id/testimonial-eligible', authenticate, authorize(['user']), istekharaController.isTestimonialEligible);

module.exports = router;
