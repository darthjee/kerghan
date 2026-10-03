import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Hex SHA-256 of a value.
 * @param {string} value - The value.
 * @returns {string} 64 hex characters.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Compares the submitted `state` secret's hash with the stored one in constant time.
 * @param {string} secret - The submitted secret.
 * @param {string} storedHash - The stored hex SHA-256.
 * @returns {boolean} Whether they match.
 */
export function secretMatches(secret: string, storedHash: string): boolean {
  const submitted = Buffer.from(sha256Hex(secret), 'hex');
  const stored = Buffer.from(storedHash, 'hex');

  return submitted.length === stored.length && timingSafeEqual(submitted, stored);
}
