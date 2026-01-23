const { User, IstekharaQuota } = require('../models');
const CognitoService = require('../services/cognito');
const { ValidationError } = require('../middleware/errorHandler');
const axios = require('axios');
const querystring = require('querystring');
const cognito = new CognitoService('user');


const { verifyGoogleToken, verifyFacebookToken, verifyAppleToken } = require('../services/socialProviders');

// List all users (admin only)
exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    next(error);
  }
};

// Register new user
exports.register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new ValidationError('user with this email already exists.');
    }

    // Register in Cognito
    const cognitoUser = await cognito.register(email, password, name);

    // Create user in database
    const newUser = await User.create({
      name,
      email
    });

    // Create free first request quota
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

    await IstekharaQuota.create({
      quantity: 1,
      amount: 0,
      description: 'First request free',
      success: true,
      user_id: newUser.id,
      expires_at: expiresAt
    });

    res.json(newUser);
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

// User login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Authenticate with Cognito
    let loggedInUser;
    try {
      loggedInUser = await cognito.login(email, password);
    } catch (error) {
      if (error.code === 'UserNotConfirmedException') {
        throw new ValidationError('Account not verified! Please check your email inbox for a verification email.');
      }
      if (error.code === 'NotAuthorizedException') {
        throw new ValidationError('Incorrect username or password.');
      }
      throw error;
    }

    // Check if user exists in database
    const dbUser = await User.findOne({ where: { email } });
    if (!dbUser) {
      throw new ValidationError('Incorrect username or password.');
    }

    res.json({
      'id-token': loggedInUser.AuthenticationResult.IdToken,
      'refresh-token': loggedInUser.AuthenticationResult.RefreshToken
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

// Get social auth URL
exports.getSocialAuthUrl = async (req, res, next) => {
  try {
    const { provider, redirect_url } = req.query;

    const redirectUri = `${process.env.DOMAIN_NAME}/users/auth/decode-token`;
    const cognitoPool = process.env.AWS_COGNITO_POOL_NAME_USER;
    const cognitoRegion = process.env.AWS_COGNITO_REGION;
    const cognitoClientId = process.env.AWS_COGNITO_CLIENT_ID_USER;

    let identityProvider;
    if (provider === 'google') {
      identityProvider = 'Google';
    } else if (provider === 'facebook') {
      identityProvider = 'Facebook';
    } else if (provider === 'apple') {
      identityProvider = 'SignInWithApple';
    } else {
      throw new ValidationError('Invalid provider');
    }

    const state = redirect_url ? encodeURIComponent(JSON.stringify({ redirect_uri: redirect_url })) : '';

    const authUrl = `https://${cognitoPool}.auth.${cognitoRegion}.amazoncognito.com/oauth2/authorize?response_type=code&identity_provider=${identityProvider}&client_id=${cognitoClientId}&redirect_uri=${redirectUri}&state=${state}`;

    res.json({ auth_url: authUrl });
  } catch (error) {
    next(error);
  }
};

// Decode Cognito code (OAuth callback)
exports.decodeCognitoCode = async (req, res, next) => {
  try {
    const { code, state } = req.query;

    const redirectUri = `${process.env.DOMAIN_NAME}/users/auth/decode-token`;
    let callbackUrl = `${process.env.USER_WEB_DOMAIN_NAME}/social/callback`;

    if (state) {
      try {
        const stateObj = JSON.parse(decodeURIComponent(state));
        if (stateObj.redirect_uri) {
          callbackUrl = stateObj.redirect_uri;
        }
      } catch (e) {
        // Invalid state, use default callback
      }
    }

    const cognitoPool = process.env.AWS_COGNITO_POOL_NAME_USER;
    const cognitoRegion = process.env.AWS_COGNITO_REGION;
    const cognitoClientId = process.env.AWS_COGNITO_CLIENT_ID_USER;

    const tokenUrl = `https://${cognitoPool}.auth.${cognitoRegion}.amazoncognito.com/oauth2/token`;

    const params = {
      grant_type: 'authorization_code',
      client_id: cognitoClientId,
      code: code,
      redirect_uri: redirectUri
    };

    const response = await axios.post(tokenUrl, querystring.stringify(params), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { id_token, access_token, refresh_token } = response.data;

    // Validate token and get user info
    const verifiedClaims = await cognito.validateToken(id_token);

    // Check if user exists, create if not
    let user = await User.findOne({ where: { email: verifiedClaims.email } });
    
    if (!user) {
      user = await User.create({
        email: verifiedClaims.email,
        name: verifiedClaims.name || verifiedClaims.email
      });

      // Create free first request quota
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365);

      await IstekharaQuota.create({
        quantity: 1,
        amount: 0,
        description: 'First request free',
        success: true,
        user_id: user.id,
        expires_at: expiresAt
      });
    }

    // Redirect with tokens
    const redirectUrl = `${callbackUrl}#access_token=${access_token}&id_token=${id_token}&refresh_token=${refresh_token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth error:', error);
    const callbackUrl = `${process.env.USER_WEB_DOMAIN_NAME}/social/callback`;
    res.redirect(callbackUrl);
  }
};

// Social mobile login------------------------------------------------------------------
exports.mobileSocialLogin = async (req, res, next) => {
  try {
    const { provider, provider_token } = req.body;

    if (!provider || !provider_token) {
      throw new ValidationError('provider and provider_token are required');
    }

    // Verify provider token
    let profile;
    if (provider === 'google') {
      profile = await verifyGoogleToken(provider_token);
    } else if (provider === 'facebook') {
      profile = await verifyFacebookToken(provider_token);
    } else if (provider === 'apple') {
      profile = await verifyAppleToken(provider_token);
    } else {
      throw new ValidationError('Invalid provider');
    }

    const { email, name } = profile;
    console.log('Social profile:', profile);
    console.log('Email:', email);
    console.log('Name:', name);

    // Ensure Cognito user exists
    await cognito.ensureUserExists(email, name);

    // Cognito login
    const tokens = await cognito.adminLogin(email);

    // Ensure DB user exists
    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({ email, name });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365);

      await IstekharaQuota.create({
        quantity: 1,
        amount: 0,
        description: 'First request free',
        success: true,
        user_id: user.id,
        expires_at: expiresAt
      });
    }

    //  Return Cognito tokens
    res.json({
      id_token: tokens.IdToken,
      access_token: tokens.AccessToken,
      refresh_token: tokens.RefreshToken
    });

  } catch (error) {
    next(error);
  }
};


module.exports = exports;
