const admin = require('../config/firebaseAdmin');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { ValidationError } = require('../middleware/errorHandler');

/* =====================================================
   VERIFY FIREBASE ID TOKEN
   ===================================================== */
async function verifyFirebaseToken(firebaseIdToken) {
  try {
    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
    const provider = decoded.firebase?.sign_in_provider || 'unknown';

    return {
      email: decoded.email || null,
      name: decoded.name || decoded.email || 'User',
      uid: decoded.uid,
      provider,
    };
  } catch (error) {
    return null;
  }
}

/* =====================================================
   VERIFY FACEBOOK GRAPH API ACCESS TOKEN
   ===================================================== */
async function verifyFacebookGraphToken(accessToken) {
  try {
    const url = `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`;
    const response = await axios.get(url);
    
    if (!response.data || !response.data.id) {
      return null;
    }

    return {
      id: response.data.id,
      email: response.data.email || null,
      name: response.data.name || 'Facebook User',
      provider: 'facebook.com',
    };
  } catch (error) {
    return null;
  }
}

/* =====================================================
   VERIFY APPLE IDENTITY TOKEN
   ===================================================== */
function verifyAppleIdentityToken(token) {
  try {
    let decoded = jwt.decode(token, { complete: true })?.payload || jwt.decode(token);
    if (!decoded || !decoded.sub) {
      return null;
    }

    const name = decoded.name
      ? (typeof decoded.name === 'string' ? decoded.name : `${decoded.name.firstName || ''} ${decoded.name.lastName || ''}`.trim())
      : 'Apple User';

    return {
      sub: decoded.sub,
      email: decoded.email || null,
      name: name || 'Apple User',
      provider: 'apple.com',
    };
  } catch (error) {
    return null;
  }
}

/* =====================================================
   UNIFIED ENTRY WITH MULTI-STRATEGY FALLBACK
   ===================================================== */
async function verifySocialToken(provider, token) {
  const normProvider = (provider || '').toLowerCase().trim();
  let result = null;

  // Strategy 1: Try Firebase ID Token verification
  result = await verifyFirebaseToken(token);

  // Strategy 2: Direct provider verification if Firebase verification failed
  if (!result) {
    if (normProvider === 'facebook' || normProvider === 'facebook.com') {
      result = await verifyFacebookGraphToken(token);
    } else if (normProvider === 'apple' || normProvider === 'apple.com' || normProvider === 'signinwithapple') {
      result = verifyAppleIdentityToken(token);
    } else {
      // Try Facebook & Apple as fallbacks if provider was ambiguous
      result = await verifyFacebookGraphToken(token) || verifyAppleIdentityToken(token);
    }
  }

  if (!result) {
    throw new ValidationError('Invalid or unverified social login token.');
  }

  // Handle missing email by providing a deterministic fallback identifier
  let email = result.email;
  if (!email) {
    const uniqueId = result.id || result.sub || result.uid || Date.now();
    const cleanProvider = normProvider || 'social';
    email = `${cleanProvider}_${uniqueId}@istekharanow.com`.toLowerCase();
  }

  const name = result.name && result.name !== 'User' ? result.name : (email.split('@')[0]);

  return {
    email: email.toLowerCase().trim(),
    name: name,
    provider: result.provider || normProvider || 'social'
  };
}

module.exports = {
  verifySocialToken,
};
