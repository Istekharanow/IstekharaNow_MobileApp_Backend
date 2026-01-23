const express = require('express');
const router = express.Router();
const instagramController = require('../controllers/instagramController');

// Instagram routes
router.post('/sync', instagramController.syncInstagram);
router.get('/posts', instagramController.getPosts);
router.get('/media-proxy', instagramController.mediaProxy);

module.exports = router;
