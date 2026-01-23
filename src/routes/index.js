const express = require('express');
const router = express.Router();

// Import route modules
const userRoutes = require('./userRoutes');
const alimRoutes = require('./alimRoutes');
const adminRoutes = require('./adminRoutes');
const istekharaRoutes = require('./istekharaRoutes');
const istekharaQuotaRoutes = require('./istekharaQuotaRoutes');
const testimonialRoutes = require('./testimonialRoutes');
const utilityRoutes = require('./utilityRoutes');
const instagramRoutes = require('./instagramRoutes');

// Mount routes
router.use('/users', userRoutes);
router.use('/alims', alimRoutes);
router.use('/admins', adminRoutes);
router.use('/istekharas', istekharaRoutes);
router.use('/istekharasQuota', istekharaQuotaRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/instagram', instagramRoutes);
router.use('/', utilityRoutes);

module.exports = router;
