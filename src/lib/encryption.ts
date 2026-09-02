import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 1;

function key(configured = env.DATA_ENCRYPTION_KEY): Buffer {
  if (!configured) throw new Error('Credential encryption is not configured.');
  const decoded = Buffer.from(configured, 'base64');
  if (decoded.length !== 32) throw new Error('Credential encryption key is invalid.');
  return decoded;
}

/** Versioned authenticated envelope: v1.nonce.tag.ciphertext (all binary fields base64url). */
export function encryptSecret(
  plaintext: string,
  context: string,
  configuredKey?: string,
): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(configuredKey), nonce);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    `v${VERSION}`,
    nonce.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptSecret(
  envelope: string,
  context: string,
  configuredKey?: string,
): string {
  const [version, nonceValue, tagValue, ciphertextValue, extra] = envelope.split('.');
  if (
    version !== `v${VERSION}` ||
    !nonceValue ||
    !tagValue ||
    !ciphertextValue ||
    extra
  ) {
    throw new Error('Encrypted credential envelope is invalid.');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    key(configuredKey),
    Buffer.from(nonceValue, 'base64url'),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function credentialHint(secret: string): string {
  const visible = secret.slice(-4);
  return visible ? `••••${visible}` : 'Configured';
}
