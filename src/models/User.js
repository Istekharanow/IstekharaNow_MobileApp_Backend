const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(60),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: true
  },
  soft_delete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  encrypted_password: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null
  },
  iv: {
    type: DataTypes.STRING(32),
    allowNull: true,
    defaultValue: null
  },
  soft_delete_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'api_user',
  timestamps: false
});

module.exports = User;
