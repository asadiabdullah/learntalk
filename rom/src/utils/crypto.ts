import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const RAW_KEY = process.env.DATABASE_ENCRYPTION_KEY || 'abcdefghijklmnopqrstuvwxyz123456';
// Stretch/hash key to ensure it is exactly 32 bytes
const ENCRYPTION_KEY = crypto.createHash('sha256').update(RAW_KEY).digest();
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12); // GCM standard IV is 12 bytes
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encryptedText
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(cipherText: string): string {
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid cipher text format. Expected iv:authTag:encrypted');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
