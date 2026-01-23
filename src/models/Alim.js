const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Alim = sequelize.define('Alim', {
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
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'api_alim',
  timestamps: false
});

module.exports = Alim;
