const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Istekhara = sequelize.define('Istekhara', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  istekhara_type: {
    type: DataTypes.STRING(1000),
    allowNull: false
  },
  language: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  audio: {
    type: DataTypes.STRING(1000),
    defaultValue: ''
  },
  quota_used_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'api_istekharaquota',
      key: 'id'
    }
  },
  reply_text: {
    type: DataTypes.STRING(1000),
    defaultValue: ''
  },
  reply_audio: {
    type: DataTypes.STRING(1000),
    defaultValue: ''
  },
  result: {
    type: DataTypes.STRING(1000),
    defaultValue: ''
  },
  surah: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  ayah: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  replied_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'api_alim',
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'api_user',
      key: 'id'
    }
  },
  opened_by_user: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'api_istekhara',
  timestamps: false
});

module.exports = Istekhara;
