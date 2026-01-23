const { InstagramPost, InstagramPostImage } = require('../models');
const axios = require('axios');

// Sync Instagram posts
exports.syncInstagram = async (req, res, next) => {
  try {
    // This would typically call an external service or API to fetch Instagram posts
    // For now, we'll return a success message
    // You can implement the actual sync logic based on your Instagram integration
    
    // Example: Call Instagram API or scraping service
    // const posts = await fetchInstagramPosts();
    // await savePostsToDatabase(posts);

    res.json({ 
      status: 'success',
      message: 'Instagram sync initiated'
    });
  } catch (error) {
    next(error);
  }
};

// Get Instagram posts
exports.getPosts = async (req, res, next) => {
  try {
    const posts = await InstagramPost.findAll({
      include: [
        {
          model: InstagramPostImage,
          as: 'images',
          attributes: ['image_url', 'order']
        }
      ],
      order: [
        ['timestamp', 'DESC'],
        [{ model: InstagramPostImage, as: 'images' }, 'order', 'ASC']
      ]
    });

    // Format response to match Django serializer
    const formattedPosts = posts.map(post => {
      const postData = post.toJSON();
      return {
        post_id: postData.post_id,
        short_code: postData.short_code,
        type: postData.type,
        caption: postData.caption,
        display_url: postData.display_url,
        video_url: postData.video_url,
        post_url: postData.post_url,
        timestamp: postData.timestamp,
        likes_count: postData.likes_count,
        is_slider: postData.is_slider,
        alt: postData.alt,
        owner_username: postData.owner_username,
        owner_fullname: postData.owner_fullname,
        images: postData.images || []
      };
    });

    res.json(formattedPosts);
  } catch (error) {
    next(error);
  }
};

// Media proxy to avoid CORS issues
exports.mediaProxy = async (req, res, next) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'Missing url param' });
    }

    // Fetch the media from Instagram
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    // Set appropriate headers
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Disposition', 'inline');

    // Pipe the response
    response.data.pipe(res);
  } catch (error) {
    console.error('Media proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;
