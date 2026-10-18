import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// Masking helper: only exposes first 6 and last 4 chars
export function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 10) return '••••••••';
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

// Generate a deterministic machine-and-user-bound key for hardware-level encryption
function getMachineMasterKey() {
  const machineData = [
    os.hostname(),
    os.userInfo().username,
    os.platform(),
    os.arch(),
    process.env.USERDOMAIN || 'LOCAL',
    process.env.COMPUTERNAME || 'NODE'
  ].join('::');

  return crypto.createHash('sha256').update(machineData).digest();
}

/**
 * Encrypt secret using AES-256-GCM tied to machine + user context
 * (or Electron safeStorage if injected)
 */
let electronSafeStorage = null;
export function setElectronSafeStorage(safeStorageInstance) {
  electronSafeStorage = safeStorageInstance;
}

export function encryptSecret(plainText) {
  if (!plainText) return '';

  if (electronSafeStorage && electronSafeStorage.isEncryptionAvailable()) {
    try {
      const buffer = electronSafeStorage.encryptString(plainText);
      return `safeStorage:${buffer.toString('base64')}`;
    } catch (err) {
      console.warn('Electron safeStorage failed, falling back to machine vault:', err.message);
    }
  }

  // OS / Machine-bound AES-256-GCM encryption
  const masterKey = getMachineMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  return `vault:${iv.toString('base64')}:${authTag}:${encrypted}`;
}

export function decryptSecret(cipherPayload) {
  if (!cipherPayload) return '';

  if (cipherPayload.startsWith('safeStorage:')) {
    if (electronSafeStorage && electronSafeStorage.isEncryptionAvailable()) {
      const base64Data = cipherPayload.replace('safeStorage:', '');
      const buffer = Buffer.from(base64Data, 'base64');
      return electronSafeStorage.decryptString(buffer);
    }
    throw new Error('Secret was encrypted with Electron safeStorage, safeStorage required to decrypt');
  }

  if (cipherPayload.startsWith('vault:')) {
    const parts = cipherPayload.split(':');
    if (parts.length !== 4) {
      throw new Error('Malformed encrypted secret payload');
    }
    const iv = Buffer.from(parts[1], 'base64');
    const authTag = Buffer.from(parts[2], 'base64');
    const encryptedText = parts[3];

    const masterKey = getMachineMasterKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Legacy or unencrypted fallback
  return cipherPayload;
}

export default {
  maskApiKey,
  encryptSecret,
  decryptSecret,
  setElectronSafeStorage
};
