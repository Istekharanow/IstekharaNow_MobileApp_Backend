const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InstagramPost = sequelize.define('InstagramPost', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  post_id: {
    type: DataTypes.STRING(64),
    unique: true,
    allowNull: false
  },
  short_code: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  caption: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  display_url: {
    type: DataTypes.STRING(1000),
    allowNull: false
  },
  video_url: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  post_url: {
    type: DataTypes.STRING(1000),
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  likes_count: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  is_slider: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  alt: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  owner_username: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  owner_fullname: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'api_instagrampost',
  timestamps: false
});

module.exports = InstagramPost;
