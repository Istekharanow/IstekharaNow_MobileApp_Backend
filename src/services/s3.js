const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION || 'us-east-2'
});

// Configure multer for S3 uploads
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET || 'istekhara-now',
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.originalname}`;
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

module.exports = { s3, upload };
