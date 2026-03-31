const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const jwkToPem = require('jwk-to-pem');
const axios = require('axios');

const SOCIAL_PASSWORD = process.env.COGNITO_SOCIAL_PASSWORD;

class CognitoService {
  constructor(type) {
    this.region = process.env.AWS_COGNITO_REGION;
    
    if (type === 'user') {
      this.clientId = process.env.AWS_COGNITO_CLIENT_ID_USER;
      this.poolId = process.env.AWS_COGNITO_POOL_ID_USER;
    } else if (type === 'alim') {
      this.clientId = process.env.AWS_COGNITO_CLIENT_ID_ALIM;
      this.poolId = process.env.AWS_COGNITO_POOL_ID_ALIM;
    } else if (type === 'admin') {
      this.clientId = process.env.AWS_COGNITO_CLIENT_ID_ADMIN;
      this.poolId = process.env.AWS_COGNITO_POOL_ID_ADMIN;
    } else {
      throw new Error(`Invalid user type: ${type}`);
    }

    this.cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
      region: this.region
    });
  }

  async register(email, password, name = null) {
    const attributes = [
      {
        Name: 'email',
        Value: email
      }
    ];

    if (name) {
      attributes.push({
        Name: 'name',
        Value: name
      });
    }

    const params = {
      ClientId: this.clientId,
      Username: email,
      Password: password,
      UserAttributes: attributes
    };

    return await this.cognitoIdentityServiceProvider.signUp(params).promise();
  }

  async login(email, password) {
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    };
    return await this.cognitoIdentityServiceProvider.initiateAuth(params).promise();
  }

  async forgotPassword(email) {
    const params = {
      ClientId: this.clientId,
      Username: email
    };

    return await this.cognitoIdentityServiceProvider.forgotPassword(params).promise();
  }

  async resetPassword(username, code, newPassword) {
    const params = {
      ClientId: this.clientId,
      Username: username,
      ConfirmationCode: code,
      Password: newPassword
    };

    return await this.cognitoIdentityServiceProvider.confirmForgotPassword(params).promise();
  }

  async confirmUser(username) {
    const cognitoAdmin = new AWS.CognitoIdentityServiceProvider({
      region: this.region,
      accessKeyId: process.env.COGNITO_ACCESS_KEY,
      secretAccessKey: process.env.COGNITO_ACCESS_SECRET
    });

    const params = {
      UserPoolId: this.poolId,
      Username: username
    };

    return await cognitoAdmin.adminConfirmSignUp(params).promise();
  }

  async validateToken(token) {
    const jwksUrl = `https://cognito-idp.${this.region}.amazonaws.com/${this.poolId}/.well-known/jwks.json`;
    const response = await axios.get(jwksUrl);
    const jwks = response.data.keys;

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const jwk = jwks.find(key => key.kid === decoded.header.kid);
    if (!jwk) {
      throw new Error('JWK not found');
    }

    const pem = jwkToPem(jwk);
    return jwt.verify(token, pem, {
      algorithms: ['RS256'],
      audience: this.clientId
    });
  }

 
// Ensure user exists in Cognito
async ensureUserExists(email, name) {
  // Normalize email to prevent case-sensitivity issues
  const normalizedEmail = email.toLowerCase().trim();

  const admin = new AWS.CognitoIdentityServiceProvider({
    region: this.region,
    accessKeyId: process.env.COGNITO_ACCESS_KEY,
    secretAccessKey: process.env.COGNITO_ACCESS_SECRET
  });

  try {
    const user = await admin.adminGetUser({
      UserPoolId: this.poolId,
      Username: normalizedEmail
    }).promise();

    // User already exists in Cognito — do NOT overwrite their password.
    // If they registered with email/password, overwriting would lock them out.
    // The adminLogin flow below uses SOCIAL_PASSWORD only for users
    // created by this method (social-only users).
    console.log(`Cognito user already exists for ${normalizedEmail}, skipping password reset.`);

  } catch (err) {
    if (err.code !== 'UserNotFoundException') throw err;

    //  New social user — create and set social password
    await admin.adminCreateUser({
      UserPoolId: this.poolId,
      Username: normalizedEmail,
      UserAttributes: [
        { Name: 'email', Value: normalizedEmail },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: name },
      ],
      MessageAction: 'SUPPRESS'
    }).promise();

    await admin.adminSetUserPassword({
      UserPoolId: this.poolId,
      Username: normalizedEmail,
      Password: SOCIAL_PASSWORD,
      Permanent: true
    }).promise();
  }
}



// Admin login to get tokens for social login users
async adminLogin(username, password = SOCIAL_PASSWORD) {
  // Normalize email to prevent case-sensitivity issues
  const normalizedUsername = username.toLowerCase().trim();

  const admin = new AWS.CognitoIdentityServiceProvider({
    region: this.region,
    accessKeyId: process.env.COGNITO_ACCESS_KEY,
    secretAccessKey: process.env.COGNITO_ACCESS_SECRET
  });

  const params = {
    AuthFlow: 'ADMIN_NO_SRP_AUTH',
    UserPoolId: this.poolId,
    ClientId: this.clientId,
    AuthParameters: {
      USERNAME: normalizedUsername,
      PASSWORD: password
    }
  };

  const response = await admin.adminInitiateAuth(params).promise();
  return response.AuthenticationResult;
}


// Admin delete user
  async adminDeleteUser(username) {
    const admin = new AWS.CognitoIdentityServiceProvider({
      region: this.region,
      accessKeyId: process.env.COGNITO_ACCESS_KEY,
      secretAccessKey: process.env.COGNITO_ACCESS_SECRET
    });

    const params = {
      UserPoolId: this.poolId,
      Username: username
    };

    try {
      return await admin.adminDeleteUser(params).promise();
    } catch (error) {
      if (error.code === 'UserNotFoundException') {
        console.log(`Cognito user not found: ${username}`);
        throw error;
      }
      throw error;
    }
  }
}

module.exports = CognitoService;
