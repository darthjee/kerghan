import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

// Env var holding the AES-256-GCM key that encrypts every integration secret.
export const INTEGRATIONS_KEY_VAR = 'KERGHAN_INTEGRATIONS_KEY';
// Env var holding the app's general secret key, which the integrations key must differ from.
const SECRET_KEY_VAR = 'KERGHAN_SECRET_KEY';

/**
 * Public dev/test placeholder for `KERGHAN_INTEGRATIONS_KEY`: base64 of the
 * 32 ASCII bytes `kerghan-dev-integrations-key-32b`. Shipped in the samples
 * and CI; refused at boot when `NODE_ENV=production`.
 */
export const INTEGRATIONS_KEY_DEV_PLACEHOLDER = 'a2VyZ2hhbi1kZXYtaW50ZWdyYXRpb25zLWtleS0zMmI=';

// Required length, in bytes, of the decoded key (AES-256).
export const INTEGRATIONS_KEY_BYTES = 32;

// Length of the key id: hex characters taken from the key's SHA-256.
const KEY_ID_LENGTH = 8;

// Shape of a canonical, padded base64 string.
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * DI token under which the validated integrations key is provided.
 */
export const INTEGRATIONS_KEY = Symbol('INTEGRATIONS_KEY');

/**
 * The validated integrations key.
 * @property {Buffer} key - The raw 32 key bytes.
 * @property {string} keyId - First 8 hex characters of SHA-256 over the raw key.
 */
export interface IntegrationsKey {
  key: Buffer;
  keyId: string;
}

/**
 * Computes the key id: the first 8 hex characters of SHA-256 over the raw
 * key bytes. The key can't be recovered from it.
 * @param {Buffer} key - The raw key bytes.
 * @returns {string} The 8-character key id.
 */
export function integrationsKeyIdFor(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, KEY_ID_LENGTH);
}

/**
 * Reads and validates `KERGHAN_INTEGRATIONS_KEY` at boot. Throws (failing
 * Nest's boot) when the key is missing or blank, isn't strict base64,
 * doesn't decode to exactly 32 bytes, equals `KERGHAN_SECRET_KEY`, or is
 * the public dev placeholder while `NODE_ENV=production`. Every error names
 * the variable and never contains its value.
 * @param {ConfigService} configService - Supplies the key, `KERGHAN_SECRET_KEY` and `NODE_ENV`.
 * @returns {IntegrationsKey} The raw key bytes and their key id.
 */
export function buildIntegrationsKey(configService: ConfigService): IntegrationsKey {
  const raw = (configService.get<string>(INTEGRATIONS_KEY_VAR) ?? '').trim();

  if (raw === '') {
    throw keyError('is missing or blank');
  }

  const key = decodeStrictBase64(raw);

  if (key.length !== INTEGRATIONS_KEY_BYTES) {
    throw keyError(`must decode to exactly ${INTEGRATIONS_KEY_BYTES} bytes`);
  }

  assertNotReused(configService, raw);

  return { key, keyId: integrationsKeyIdFor(key) };
}

/**
 * Rejects a key equal to `KERGHAN_SECRET_KEY`, or the public placeholder in production.
 * @param {ConfigService} configService - Supplies `KERGHAN_SECRET_KEY` and `NODE_ENV`.
 * @param {string} raw - The trimmed key value.
 * @returns {void}
 */
function assertNotReused(configService: ConfigService, raw: string): void {
  if (raw === (configService.get<string>(SECRET_KEY_VAR) ?? '').trim()) {
    throw keyError(`must differ from ${SECRET_KEY_VAR}`);
  }

  if (raw === INTEGRATIONS_KEY_DEV_PLACEHOLDER && configService.get<string>('NODE_ENV') === 'production') {
    throw keyError('must not be the public dev placeholder in production');
  }
}

/**
 * Decodes a base64 string, rejecting anything that isn't canonical base64
 * (Node's decoder is lenient and would silently skip invalid characters).
 * @param {string} raw - The candidate base64 string.
 * @returns {Buffer} The decoded bytes.
 */
function decodeStrictBase64(raw: string): Buffer {
  const decoded = Buffer.from(raw, 'base64');

  if (!BASE64_PATTERN.test(raw) || decoded.toString('base64') !== raw) {
    throw keyError('must be valid base64');
  }

  return decoded;
}

/**
 * Builds a boot error naming the variable, never its value.
 * @param {string} problem - What is wrong with the key.
 * @returns {Error} The error to throw.
 */
function keyError(problem: string): Error {
  return new Error(`${INTEGRATIONS_KEY_VAR} ${problem} (generate one with \`openssl rand -base64 32\`)`);
}
