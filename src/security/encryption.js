const crypto = require('crypto');

/**
 * Módulo de encriptación AES-256-GCM
 * Proporciona funciones para cifrar y descifrar datos sensibles en reposo
 * 
 * Formato almacenado en BD: base64(IV || authTag || ciphertext)
 * IV: 12 bytes (96 bits)
 * authTag: 16 bytes (128 bits)
 * ciphertext: variable
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Obtiene la clave de encriptación desde las variables de entorno
 * @returns {Buffer} Clave de 32 bytes (256 bits)
 * @throws {Error} Si ENCRYPTION_KEY no está configurada
 */
function getEncryptionKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  
  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY no está configurada. ' +
      'Ejecuta: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" ' +
      'y pegarla en .env'
    );
  }
  
  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY debe ser 64 caracteres hexadecimales (32 bytes)');
  }
  
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encripta un string con AES-256-GCM
 * @param {string} plaintext - Texto a cifrar
 * @returns {string} Base64 del formato: IV || authTag || ciphertext
 */
function encrypt(plaintext) {
  try {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('El texto a encriptar debe ser un string no vacío');
    }
    
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'binary');
    encrypted += cipher.final('binary');
    
    const authTag = cipher.getAuthTag();
    
    // Formato: IV || authTag || ciphertext
    const buffer = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'binary')
    ]);
    
    return buffer.toString('base64');
  } catch (err) {
    throw new Error(`Error al encriptar: ${err.message}`);
  }
}

/**
 * Desencripta un string cifrado con AES-256-GCM
 * @param {string} encryptedBase64 - Base64 del formato: IV || authTag || ciphertext
 * @returns {string} Texto descifrado
 */
function decrypt(encryptedBase64) {
  try {
    if (!encryptedBase64 || typeof encryptedBase64 !== 'string') {
      throw new Error('El texto a desencriptar debe ser un string no vacío');
    }
    
    const key = getEncryptionKey();
    const buffer = Buffer.from(encryptedBase64, 'base64');
    
    // Extraer componentes
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buffer.subarray(IV_LENGTH + TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, 'binary', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    throw new Error(`Error al desencriptar: ${err.message}`);
  }
}

module.exports = {
  encrypt,
  decrypt
};
