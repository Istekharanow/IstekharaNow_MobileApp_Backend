const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* ===================== GOOGLE ===================== */
async function verifyGoogleToken(token) {
  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();

  if (!payload.email) {
    throw new Error('Google account has no email');
  }

  return {
    email: payload.email,
    name: payload.name || payload.email
  };
}

/* ===================== FACEBOOK ===================== */
async function verifyFacebookToken(token) {
  const response = await axios.get(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${token}`
  );

  if (!response.data.email) {
    throw new Error('Facebook account has no email');
  }

  return {
    email: response.data.email,
    name: response.data.name
  };
}

/* ===================== APPLE ===================== */
async function verifyAppleToken(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded) throw new Error('Invalid Apple token');

  const { kid } = decoded.header;

  const appleKeys = await axios.get(
    'https://appleid.apple.com/auth/keys'
  );

  const jwk = appleKeys.data.keys.find(key => key.kid === kid);
  if (!jwk) throw new Error('Apple JWK not found');

  const pem = jwkToPem(jwk);

  const payload = jwt.verify(token, pem, {
    algorithms: ['RS256']
  });

  if (!payload.email) {
    throw new Error('Apple account has no email');
  }

  return {
    email: payload.email,
    name: payload.email
  };
}

module.exports = {
  verifyGoogleToken,
  verifyFacebookToken,
  verifyAppleToken
};
