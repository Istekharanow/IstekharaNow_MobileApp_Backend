const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const testimonialController = require('../controllers/testimonialController');

// Testimonial routes (RESTful)
router.get('/', testimonialController.list);
router.post('/', authenticate, authorize(['user']), testimonialController.create);
router.get('/:id', testimonialController.get);
router.put('/:id', authenticate, authorize(['admin']), testimonialController.update);
router.patch('/:id', authenticate, authorize(['admin']), testimonialController.update);
router.delete('/:id', authenticate, authorize(['admin']), testimonialController.delete);

module.exports = router;
