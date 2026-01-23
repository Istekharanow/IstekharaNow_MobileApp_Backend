const { Alim } = require('../models');
const CognitoService = require('../services/cognito');
const { ValidationError } = require('../middleware/errorHandler');

const cognito = new CognitoService('alim');

// List all alims (admin only)
exports.listAlims = async (req, res, next) => {
  try {
    const alims = await Alim.findAll();
    res.json(alims);
  } catch (error) {
    next(error);
  }
};

// Create new alim (admin only)
exports.createAlim = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if alim already exists
    const existingAlim = await Alim.findOne({ where: { email } });
    if (existingAlim) {
      throw new ValidationError('alim with this email already exists.');
    }

    // Register in Cognito
    const cognitoAlim = await cognito.register(email, password, name);

    // Create alim in database
    const newAlim = await Alim.create({
      name,
      email
    });

    // Confirm user in Cognito (admin creates pre-confirmed alims)
    await cognito.confirmUser(cognitoAlim.UserSub);

    res.json(newAlim);
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

// Alim login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Authenticate with Cognito
    let loggedInAlim;
    try {
      loggedInAlim = await cognito.login(email, password);
    } catch (error) {
      if (error.code === 'UserNotConfirmedException') {
        throw new ValidationError('Account not verified!');
      }
      if (error.code === 'NotAuthorizedException') {
        throw new ValidationError('Incorrect username or password.');
      }
      throw error;
    }

    // Check if alim exists in database
    const dbAlim = await Alim.findOne({ where: { email } });
    if (!dbAlim) {
      throw new ValidationError('Incorrect username or password.');
    }

    res.json({
      'refresh-token': loggedInAlim.AuthenticationResult.RefreshToken,
      'id-token': loggedInAlim.AuthenticationResult.IdToken
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

module.exports = exports;
