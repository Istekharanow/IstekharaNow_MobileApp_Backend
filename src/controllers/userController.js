const { User, IstekharaQuota } = require('../models');
const CognitoService = require('../services/cognito');
const { ValidationError } = require('../middleware/errorHandler');
const axios = require('axios');
const querystring = require('querystring');
const cognito = new CognitoService('user');
const { encryptPassword, decryptPassword } = require('../utils/cryptoProvider');


// const { verifyGoogleToken, verifyFacebookToken, verifyAppleToken } = require('../services/socialProviders');
const { verifySocialToken } = require('../services/socialProviders');


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
    let { email, password, name } = req.body;
    email = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      // Check if this is a soft-deleted account that can be reactivated
      if (existingUser.soft_delete) {
        const softDeleteDate = new Date(existingUser.soft_delete_date);
        const daysSinceDelete = (Date.now() - softDeleteDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceDelete < 30) {
          // Reactivate the account within 30-day window
          await existingUser.update({
            soft_delete: false,
            soft_delete_date: null
          });
          return res.json({
            message: 'Your account has been reactivated successfully!',
            user: existingUser
          });
        }
        // If 30+ days passed, cron should have deleted it. But just in case, let it fall through.
      } else {
        throw new ValidationError('User with this email already exists.');
      }
    }
    // Register in Cognito
    const cognitoUser = await cognito.register(email, password, name);

    // Encrypt password for fallback DB auth
    const { encryptedData, iv } = encryptPassword(password);

    // Create user in database
    const newUser = await User.create({
      name,
      email,
      encrypted_password: encryptedData,
      iv: iv
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
    let { email, password } = req.body;
    email = email.toLowerCase().trim();

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

    // Temporary helper to backfill encrypted manual passwords for social login bypass
    await exports.hydrateEncryptedPassword(email, password);

    // Check if user exists in database
    const dbUser = await User.findOne({ where: { email } });
    if (!dbUser) {
      throw new ValidationError('Incorrect username or password.');
    }

    // Block soft-deleted users from logging in
    if (dbUser.soft_delete) {
      throw new ValidationError('Your account has been deleted. Please sign up again within 30 days to recover it.');
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

    // Update the local DB with the new encrypted password
    const dbUser = await User.findOne({ where: { email } });
    if (dbUser) {
      const { encryptedData, iv } = encryptPassword(password);
      await dbUser.update({
        encrypted_password: encryptedData,
        iv: iv
      });
    }

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

    // Normalize email to prevent case-sensitivity duplicates
    const normalizedEmail = verifiedClaims.email.toLowerCase().trim();

    // Check if user exists, create if not
    let user = await User.findOne({ where: { email: normalizedEmail } });
    
    if (user && user.soft_delete) {
      // Reactivate soft-deleted account
      const softDeleteDate = new Date(user.soft_delete_date);
      const daysSinceDelete = (Date.now() - softDeleteDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceDelete < 30) {
        await user.update({ soft_delete: false, soft_delete_date: null });
      }
    } else if (!user) {
      user = await User.create({
        email: normalizedEmail,
        name: verifiedClaims.name || normalizedEmail
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
    
    const profile = await verifySocialToken(provider, provider_token);

    // Normalize email to prevent case-sensitivity duplicates
    const email = profile.email.toLowerCase().trim();
    const name = profile.name;
    // console.log('Social profile:', profile);
    // console.log('Normalized Email:', email);
    // console.log('Name:', name);

    // Ensure Cognito user exists
    await cognito.ensureUserExists(email, name);

    // Cognito login
    let tokens;
    try {
      tokens = await cognito.adminLogin(email);
    } catch (loginError) {
      if (loginError.code === 'NotAuthorizedException') {
        const fallbackUser = await User.findOne({ where: { email } });

        // If user doesn't exist yet, or hasn't saved an encrypted password, standard error
        if (!fallbackUser || !fallbackUser.encrypted_password || !fallbackUser.iv) {
           throw new ValidationError('This email is already registered using a password. Please log in using your email and password.');
        }

        // We decrypt their DB password
        const decryptedPassword = decryptPassword(fallbackUser.encrypted_password, fallbackUser.iv);
        
        if (!decryptedPassword) {
           throw new ValidationError('Password decryption failed. Please log in using your standard email and password.');
        }

        // Try Cognito login again but this time using their actual decrypted password
        try {
          // Assuming you already adjusted adminLogin method defaults 
          tokens = await cognito.adminLogin(email, decryptedPassword);
        } catch (secondLoginError) {
          throw new ValidationError('Failed to auto-login. Please log in using your standard email and password.');
        }
      } else {
        throw loginError;
      }
    }

    // Ensure DB user exists
    let user = await User.findOne({ where: { email } });

    if (user && user.soft_delete) {
      // Reactivate soft-deleted account
      const softDeleteDate = new Date(user.soft_delete_date);
      const daysSinceDelete = (Date.now() - softDeleteDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceDelete < 30) {
        await user.update({ soft_delete: false, soft_delete_date: null });
      }
    } else if (!user) {
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


// Delete user account (soft delete)
exports.deleteUser = async (req, res, next) => {
  try {
    // Read the email from the authenticated user token (req.user.email)
    const email = req.user?.email;

    if (!email) {
      throw new ValidationError('Email is required and must be authenticated.');
    }

    // Find user in database
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        message: 'User does not exist or has already been deleted.',
        status: false,
        status_code: 404
      });
    }

    if (user.soft_delete) {
      return res.status(400).json({
        message: 'Your account is already marked for deletion.',
        status: false,
        status_code: 400
      });
    }

    // Soft delete — mark the user, don't remove anything yet
    await user.update({
      soft_delete: true,
      soft_delete_date: new Date()
    });

    res.json({ message: 'Your account has been deleted. You can recover it by signing up again within 30 days.' });

  } catch (error) {
    next(error);
  }
};

// Helper function to hydrate db passwords on login
exports.hydrateEncryptedPassword = async (email, plainTextPassword) => {
  try {
    const user = await User.findOne({ where: { email } });
    
    // Only update if the user exists and doesn't already have an encrypted password
    if (user && !user.encrypted_password) {
      const { encryptedData, iv } = encryptPassword(plainTextPassword);
      await user.update({
        encrypted_password: encryptedData,
        iv: iv
      });
    }
  } catch (error) {
    console.error(`Failed to backfill encrypted password for ${email}:`, error);
  }
};

module.exports = exports;
