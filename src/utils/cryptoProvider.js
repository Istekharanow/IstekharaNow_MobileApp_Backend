const crypto = require('crypto');

// The encryption algorithm
const ALGORITHM = 'aes-256-cbc';

// Helper to get exactly 32 bytes key from the ENCRYPTION_SECRET_KEY
// Falls back to a default if not set (NOT SECURE FOR PRODUCTION)
function getSecretKey() {
  const secret = process.env.ENCRYPTION_SECRET_KEY || 'default_secret_key_32_chars_long!';
  // Make sure it's exactly 32 bytes (256 chars)
  return crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);
}

/**
 * Encrypts a plain text string using AES-256-CBC.
 * 
 * @param {string} text - The plain text string to encrypt.
 * @returns {Object} An object containing the generated IV (hex) and the encrypted data (hex).
 */
exports.encryptPassword = (text) => {
  if (!text) return { iv: null, encryptedData: null };

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(getSecretKey()), iv);
  
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted.toString('hex')
  };
};

/**
 * Decrypts an encrypted hex string back into plain text.
 * 
 * @param {string} encryptedData - The hex string to decrypt.
 * @param {string} ivString - The initialization vector in hex format.
 * @returns {string} The decrypted plain text.
 */
exports.decryptPassword = (encryptedData, ivString) => {
  if (!encryptedData || !ivString) return null;

  try {
    const iv = Buffer.from(ivString, 'hex');
    const encryptedText = Buffer.from(encryptedData, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(getSecretKey()), iv);
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    console.error('Password decryption failed:', error.message);
    return null; // Return null if decryption fails (e.g. wrong key/iv)
  }
};
