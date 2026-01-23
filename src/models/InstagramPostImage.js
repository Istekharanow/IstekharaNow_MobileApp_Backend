const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InstagramPostImage = sequelize.define('InstagramPostImage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  post_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'api_instagrampost',
      key: 'id'
    }
  },
  image_url: {
    type: DataTypes.STRING(1000),
    allowNull: false
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'api_instagrampostimage',
  timestamps: false
});

module.exports = InstagramPostImage;
