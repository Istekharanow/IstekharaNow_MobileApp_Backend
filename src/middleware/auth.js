const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const axios = require('axios');
const { User, Alim } = require('../models');

// Cache for JWKs
let jwksCache = {};

// Get JWKs for a Cognito pool
async function getJWKs(region, poolId) {
  const cacheKey = `${region}_${poolId}`;
  
  if (jwksCache[cacheKey]) {
    return jwksCache[cacheKey];
  }

  const jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${poolId}/.well-known/jwks.json`;
  const response = await axios.get(jwksUrl);
  jwksCache[cacheKey] = response.data.keys;
  return response.data.keys;
}

// Verify Cognito JWT token
async function verifyCognitoToken(token, region, poolId, clientId) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const jwks = await getJWKs(region, poolId);
    const jwk = jwks.find(key => key.kid === decoded.header.kid);
    
    if (!jwk) {
      throw new Error('JWK not found');
    }

    const pem = jwkToPem(jwk);
    const verified = jwt.verify(token, pem, {
      algorithms: ['RS256'],
      audience: clientId
    });

    return verified;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers['x-id-token'];
    
    if (!token) {
      return res.status(401).json({
        message: 'Authentication required',
        result: {},
        status: false,
        status_code: 401
      });
    }

    // Try to verify with each user type
    let verified = null;
    let userType = null;

    // Try User pool
    try {
      verified = await verifyCognitoToken(
        token,
        process.env.AWS_COGNITO_REGION,
        process.env.AWS_COGNITO_POOL_ID_USER,
        process.env.AWS_COGNITO_CLIENT_ID_USER
      );
      userType = 'user';
      
      const user = await User.findOne({ where: { email: verified.email } });
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          user_type: 'user'
        };
      }
    } catch (e) {
      // Try Alim pool
      try {
        verified = await verifyCognitoToken(
          token,
          process.env.AWS_COGNITO_REGION,
          process.env.AWS_COGNITO_POOL_ID_ALIM,
          process.env.AWS_COGNITO_CLIENT_ID_ALIM
        );
        userType = 'alim';
        
        const alim = await Alim.findOne({ where: { email: verified.email } });
        if (alim) {
          req.user = {
            id: alim.id,
            email: alim.email,
            name: alim.name,
            user_type: 'alim'
          };
        }
      } catch (e2) {
        // Try Admin pool
        try {
          verified = await verifyCognitoToken(
            token,
            process.env.AWS_COGNITO_REGION,
            process.env.AWS_COGNITO_POOL_ID_ADMIN,
            process.env.AWS_COGNITO_CLIENT_ID_ADMIN
          );
          userType = 'admin';
          
          req.user = {
            email: verified.email,
            user_type: 'admin'
          };
        } catch (e3) {
          throw new Error('Invalid token for all user types');
        }
      }
    }

    if (!req.user) {
      return res.status(401).json({
        message: 'User not found',
        result: {},
        status: false,
        status_code: 401
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      message: error.message || 'Authentication failed',
      result: {},
      status: false,
      status_code: 401
    });
  }
};

// Authorization middleware
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        result: {},
        status: false,
        status_code: 401
      });
    }

    if (!allowedRoles.includes(req.user.user_type)) {
      return res.status(403).json({
        message: 'Access forbidden',
        result: {},
        status: false,
        status_code: 403
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
