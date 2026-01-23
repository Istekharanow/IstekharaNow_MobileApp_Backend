const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ContactForm = sequelize.define('ContactForm', {
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
  message: {
    type: DataTypes.STRING(1000),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'api_contactform',
  timestamps: false
});

module.exports = ContactForm;
