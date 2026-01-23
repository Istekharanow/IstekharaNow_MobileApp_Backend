const { User, Alim, IstekharaQuota } = require('../models');
const CognitoService = require('../services/cognito');
const { ValidationError } = require('../middleware/errorHandler');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const cognito = new CognitoService('admin');

// Create admin
exports.createAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Register in Cognito
    const newAdmin = await cognito.register(email, password);

    // Confirm user immediately
    await cognito.confirmUser(newAdmin.UserSub);

    res.json(newAdmin);
  } catch (error) {
    if (error.code === 'UsernameExistsException') {
      return next(new ValidationError('An account with this email already exists.'));
    }
    if (error.code === 'InvalidPasswordException') {
      return next(new ValidationError(error.message));
    }
    if (error.code === 'InvalidParameterException') {
      return next(new ValidationError(error.message));
    }
    next(error);
  }
};

// Admin login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Authenticate with Cognito
    let loggedInAdmin;
    try {
      loggedInAdmin = await cognito.login(email, password);
    } catch (error) {
      if (error.code === 'NotAuthorizedException') {
        throw new ValidationError('Incorrect username or password.');
      }
      throw error;
    }

    res.json({
      'id-token': loggedInAdmin.AuthenticationResult.IdToken,
      'refresh-token': loggedInAdmin.AuthenticationResult.RefreshToken
    });
  } catch (error) {
    next(error);
  }
};

// Forgot password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    await cognito.forgotPassword(email);
    res.json({ message: 'Password reset email sent.' });
  } catch (error) {
    if (error.code) {
      return next(new ValidationError(error.message));
    }
    next(error);
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, password, code } = req.body;
    await cognito.resetPassword(email, code, password);
    res.json({ message: 'Password reset successful.' });
  } catch (error) {
    if (error.code) {
      return next(new ValidationError(error.message));
    }
    next(error);
  }
};

// Get dashboard overview
exports.getOverview = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    // Default to last 1 year
    const today = new Date();
    let startDate, endDate;

    if (!start_date || !end_date) {
      endDate = today;
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 365);
    } else {
      startDate = new Date(start_date);
      endDate = new Date(end_date);
    }

    // Determine aggregation granularity
    const rangeDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    const isShortRange = rangeDays < 100;
    const granularity = isShortRange ? 'weekly' : 'monthly';
    const dateFormat = isShortRange ? '%d %b' : '%b %Y';

    // Get total counts
    const totalUsers = await User.count({
      where: {
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      }
    });

    const totalAlims = await Alim.count();

    const totalPayments = await IstekharaQuota.sum('amount', {
      where: {
        success: true,
        redeem: false,
        amount: { [Op.gt]: 0 },
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      }
    });

    // Revenue aggregation
    let revenueQuery;
    if (isShortRange) {
      // Weekly aggregation
      revenueQuery = `
        SELECT 
          DATE_TRUNC('week', created_at) as period,
          SUM(amount) as total
        FROM api_istekharaquota
        WHERE success = true 
          AND redeem = false 
          AND amount > 0
          AND created_at BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY period
      `;
    } else {
      // Monthly aggregation
      revenueQuery = `
        SELECT 
          DATE_TRUNC('month', created_at) as period,
          SUM(amount) as total
        FROM api_istekharaquota
        WHERE success = true 
          AND redeem = false 
          AND amount > 0
          AND created_at BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY period
      `;
    }

    const revenueResults = await sequelize.query(revenueQuery, {
      bind: [startDate, endDate],
      type: sequelize.QueryTypes.SELECT
    });

    const revenue = revenueResults.map(row => ({
      period: formatDate(new Date(row.period), isShortRange),
      total: parseInt(row.total)
    }));

    // Signup aggregation
    let signupQuery;
    if (isShortRange) {
      signupQuery = `
        SELECT 
          DATE_TRUNC('week', created_at) as period,
          COUNT(id) as count
        FROM api_user
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY period
      `;
    } else {
      signupQuery = `
        SELECT 
          DATE_TRUNC('month', created_at) as period,
          COUNT(id) as count
        FROM api_user
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY period
      `;
    }

    const signupResults = await sequelize.query(signupQuery, {
      bind: [startDate, endDate],
      type: sequelize.QueryTypes.SELECT
    });

    const signups = signupResults.map(row => ({
      period: formatDate(new Date(row.period), isShortRange),
      count: parseInt(row.count)
    }));

    res.json({
      total_users: totalUsers,
      total_alims: totalAlims,
      total_payments: {
        amount: totalPayments || 0,
        currency: 'USD'
      },
      revenue: revenue,
      signups: signups,
      granularity: granularity
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to format dates
function formatDate(date, isShortRange) {
  if (isShortRange) {
    // Format as "DD Mon" (e.g., "15 Jan")
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    return `${day} ${month}`;
  } else {
    // Format as "Mon YYYY" (e.g., "Jan 2024")
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `${month} ${year}`;
  }
}

module.exports = exports;
