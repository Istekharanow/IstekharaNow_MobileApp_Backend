const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const admin = require('../config/firebaseAdmin');


/* =====================================================
   GOOGLE (Firebase ID Token)
   ===================================================== */
async function verifyGoogleToken(firebaseIdToken) {
  try {
    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);

    if (!decoded.email) {
      throw new Error('Firebase Google token has no email');
    }

    return {
      email: decoded.email,
      name: decoded.name || decoded.email,
      provider: 'google',
    };
  } catch (error) {
    throw new Error(`Google verification failed: ${error.message}`);
  }
}

/* =====================================================
   FACEBOOK (Access Token)
   ===================================================== */
async function verifyFacebookToken(accessToken) {
  try {
    const response = await axios.get(
      'https://graph.facebook.com/me',
      {
        params: {
          fields: 'id,name,email',
          access_token: accessToken,
        },
      }
    );

    const data = response.data;

    if (!data.email) {
      throw new Error('Facebook token has no email');
    }

    return {
      email: data.email,
      name: data.name || data.email,
      provider: 'facebook',
    };
  } catch (error) {
    throw new Error(`Facebook verification failed: ${error.message}`);
  }
}

/* =====================================================
   APPLE (Identity Token)
   ===================================================== */
async function verifyAppleToken(identityToken) {
  try {
    const decoded = jwt.decode(identityToken, { complete: true });
    if (!decoded) throw new Error('Invalid Apple token');

    const { kid } = decoded.header;

    const appleKeys = await axios.get(
      'https://appleid.apple.com/auth/keys'
    );

    const jwk = appleKeys.data.keys.find(key => key.kid === kid);
    if (!jwk) throw new Error('Apple public key not found');

    const pem = jwkToPem(jwk);

    const payload = jwt.verify(identityToken, pem, {
      algorithms: ['RS256'],
    });

    if (!payload.email) {
      throw new Error('Apple token has no email');
    }

    return {
      email: payload.email,
      name: payload.email,
      provider: 'apple',
    };
  } catch (error) {
    throw new Error(`Apple verification failed: ${error.message}`);
  }
}

/* =====================================================
   UNIFIED ENTRY
   ===================================================== */
async function verifySocialToken(provider, token) {
  try {
    switch (provider) {
      case 'google':
        return verifyGoogleToken(token);

      case 'facebook':
        return verifyFacebookToken(token);

      case 'apple':
        return verifyAppleToken(token);

      default:
        throw new Error('Unsupported provider');
    }
  } catch (error) {
    throw new Error(`Social token verification failed: ${error.message}`);
  }
}

module.exports = {
  verifySocialToken,
};
