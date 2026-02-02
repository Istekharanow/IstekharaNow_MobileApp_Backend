const admin = require('../config/firebaseAdmin');
const { ValidationError } = require('../middleware/errorHandler');

/* =====================================================
   VERIFY FIREBASE ID TOKEN (GOOGLE / FACEBOOK / APPLE)
   ===================================================== */
async function verifyFirebaseToken(firebaseIdToken) {
  try {
    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);

    if (!decoded.email) {
      throw new ValidationError('Firebase token has no email');
    }

    // Identify provider from Firebase
    const provider =
      decoded.firebase?.sign_in_provider || 'unknown';

    return {
      email: decoded.email,
      name: decoded.name || decoded.email,
      provider, // google.com | facebook.com | apple.com
    };
  } catch (error) {
    if (error.code === 'auth/id-token-expired') {
      throw new ValidationError('Firebase ID token has expired. Get a fresh ID token from your client app and try again.');
    }
    if (error.code === 'auth/argument-error') {
      throw new ValidationError('Invalid Firebase ID token.');
    }
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error(`Firebase token verification failed: ${error.message}`);
  }
}

/* =====================================================
   UNIFIED ENTRY
   ===================================================== */
async function verifySocialToken(provider, token) {
  // provider param is now OPTIONAL
  return verifyFirebaseToken(token);
}

module.exports = {
  verifySocialToken,
};
