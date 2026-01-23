const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IstekharaQuota = sequelize.define('IstekharaQuota', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(1000),
    allowNull: false
  },
  stripe_session_id: {
    type: DataTypes.STRING(100),
    defaultValue: ''
  },
  stripe_subscription_id: {
    type: DataTypes.STRING(100),
    defaultValue: ''
  },
  paypal_order_id: {
    type: DataTypes.STRING(100),
    defaultValue: ''
  },
  paypal_subscription_id: {
    type: DataTypes.STRING(100),
    defaultValue: ''
  },
  apple_transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  google_purchase_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  amount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: ''
  },
  success: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  failure: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  recurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  recurring_interval: {
    type: DataTypes.STRING(10),
    defaultValue: ''
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'api_user',
      key: 'id'
    }
  },
  redeem: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
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
  tableName: 'api_istekharaquota',
  timestamps: false
});

module.exports = IstekharaQuota;
