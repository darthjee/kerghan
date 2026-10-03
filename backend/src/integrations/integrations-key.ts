import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

// Env var holding the AES-256-GCM key that encrypts every integration secret.
export const INTEGRATIONS_KEY_VAR = 'KERGHAN_INTEGRATIONS_KEY';
// Env var holding the optional, comma-separated list of retired (decrypt-only) integrations keys.
export const PREVIOUS_INTEGRATIONS_KEYS_VAR = 'KERGHAN_PREVIOUS_INTEGRATIONS_KEYS';
// Env var holding the app's general secret key, which the integrations keys must differ from.
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
 * DI token under which the validated integrations key set is provided.
 */
export const INTEGRATIONS_KEY = Symbol('INTEGRATIONS_KEY');

/**
 * One validated integrations key.
 * @property {Buffer} key - The raw 32 key bytes.
 * @property {string} keyId - First 8 hex characters of SHA-256 over the raw key.
 */
export interface KeyEntry {
  key: Buffer;
  keyId: string;
}

/**
 * The validated integrations key set: the current key encrypts everything
 * new, previous keys only decrypt rows stored under them.
 * @property {KeyEntry} current - The current key (`KERGHAN_INTEGRATIONS_KEY`).
 * @property {KeyEntry[]} previous - Retired keys (`KERGHAN_PREVIOUS_INTEGRATIONS_KEYS`), in configured order.
 * @property {Map<string, Buffer>} byId - Every configured key, by key id.
 */
export interface IntegrationsKey {
  current: KeyEntry;
  previous: KeyEntry[];
  byId: Map<string, Buffer>;
}

// One raw previous-key entry and its 1-based position in the configured list.
interface PreviousKeyEntry {
  value: string;
  position: number;
}

// Where a candidate key comes from, used to word its boot errors.
interface KeySource {
  variable: string;
  position?: number;
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
 * Assembles a key set from raw key bytes, computing every key id. Throws
 * when two keys share a key id (a stored `secret_key_id` would be ambiguous).
 * @param {Buffer} current - The current key bytes.
 * @param {Buffer[]} [previous] - The previous key bytes, in order.
 * @returns {IntegrationsKey} The key set.
 */
export function integrationsKeySetOf(current: Buffer, previous: Buffer[] = []): IntegrationsKey {
  const toEntry = (key: Buffer): KeyEntry => ({ key, keyId: integrationsKeyIdFor(key) });
  const set: IntegrationsKey = { current: toEntry(current), previous: previous.map(toEntry), byId: new Map() };

  for (const entry of [set.current, ...set.previous]) {
    if (set.byId.has(entry.keyId)) {
      throw new Error(`${PREVIOUS_INTEGRATIONS_KEYS_VAR} holds two keys sharing the key id ${entry.keyId}`);
    }

    set.byId.set(entry.keyId, entry.key);
  }

  return set;
}

/**
 * Reads and validates `KERGHAN_INTEGRATIONS_KEY` and
 * `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` at boot. Throws (failing Nest's boot)
 * when the current key is missing or blank, or when any key isn't strict
 * base64, doesn't decode to exactly 32 bytes, equals `KERGHAN_SECRET_KEY`,
 * or is the public dev placeholder while `NODE_ENV=production`; also when
 * two keys share a key id. Previous keys are trimmed, and blank entries,
 * duplicates and entries equal to the current key are dropped. Every error
 * names the variable (and the 1-based entry position for previous keys),
 * never a value.
 * @param {ConfigService} configService - Supplies both keys, `KERGHAN_SECRET_KEY` and `NODE_ENV`.
 * @returns {IntegrationsKey} The validated key set.
 */
export function buildIntegrationsKeys(configService: ConfigService): IntegrationsKey {
  const raw = (configService.get<string>(INTEGRATIONS_KEY_VAR) ?? '').trim();

  if (raw === '') {
    throw keyError({ variable: INTEGRATIONS_KEY_VAR }, 'is missing or blank');
  }

  const current = validateKey(configService, raw, { variable: INTEGRATIONS_KEY_VAR });
  const previous = parsePreviousKeys(configService.get<string>(PREVIOUS_INTEGRATIONS_KEYS_VAR) ?? '', raw)
    .map(({ value, position }) => validateKey(configService, value, { variable: PREVIOUS_INTEGRATIONS_KEYS_VAR, position }));

  return integrationsKeySetOf(current, previous);
}

/**
 * Splits and cleans the previous-keys list.
 * @param {string} raw - The raw `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` value.
 * @param {string} current - The trimmed current key, excluded from the result.
 * @returns {PreviousKeyEntry[]} The unique, non-blank previous keys, in first-occurrence
 *   order, each with its 1-based position in the raw list.
 */
function parsePreviousKeys(raw: string, current: string): PreviousKeyEntry[] {
  const seen = new Set<string>([current]);
  const entries: PreviousKeyEntry[] = [];

  raw.split(',').forEach((entry, index) => {
    const value = entry.trim();

    if (value !== '' && !seen.has(value)) {
      seen.add(value);
      entries.push({ value, position: index + 1 });
    }
  });

  return entries;
}

/**
 * Validates one non-blank key value and decodes it.
 * @param {ConfigService} configService - Supplies `KERGHAN_SECRET_KEY` and `NODE_ENV`.
 * @param {string} raw - The trimmed key value.
 * @param {KeySource} source - Where the value comes from, for error messages.
 * @returns {Buffer} The raw 32 key bytes.
 */
function validateKey(configService: ConfigService, raw: string, source: KeySource): Buffer {
  const key = decodeStrictBase64(raw, source);

  if (key.length !== INTEGRATIONS_KEY_BYTES) {
    throw keyError(source, `must decode to exactly ${INTEGRATIONS_KEY_BYTES} bytes`);
  }

  assertNotReused(configService, raw, source);

  return key;
}

/**
 * Rejects a key equal to `KERGHAN_SECRET_KEY`, or the public placeholder in production.
 * @param {ConfigService} configService - Supplies `KERGHAN_SECRET_KEY` and `NODE_ENV`.
 * @param {string} raw - The trimmed key value.
 * @param {KeySource} source - Where the value comes from, for error messages.
 * @returns {void}
 */
function assertNotReused(configService: ConfigService, raw: string, source: KeySource): void {
  if (raw === (configService.get<string>(SECRET_KEY_VAR) ?? '').trim()) {
    throw keyError(source, `must differ from ${SECRET_KEY_VAR}`);
  }

  if (raw === INTEGRATIONS_KEY_DEV_PLACEHOLDER && configService.get<string>('NODE_ENV') === 'production') {
    throw keyError(source, 'must not be the public dev placeholder in production');
  }
}

/**
 * Decodes a base64 string, rejecting anything that isn't canonical base64
 * (Node's decoder is lenient and would silently skip invalid characters).
 * @param {string} raw - The candidate base64 string.
 * @param {KeySource} source - Where the value comes from, for error messages.
 * @returns {Buffer} The decoded bytes.
 */
function decodeStrictBase64(raw: string, source: KeySource): Buffer {
  const decoded = Buffer.from(raw, 'base64');

  if (!BASE64_PATTERN.test(raw) || decoded.toString('base64') !== raw) {
    throw keyError(source, 'must be valid base64');
  }

  return decoded;
}

/**
 * Builds a boot error naming the variable (and entry position), never the value.
 * @param {KeySource} source - Where the value comes from.
 * @param {string} problem - What is wrong with the key.
 * @returns {Error} The error to throw.
 */
function keyError(source: KeySource, problem: string): Error {
  const subject = source.position === undefined ? source.variable : `${source.variable} entry ${source.position}`;

  return new Error(`${subject} ${problem} (generate one with \`openssl rand -base64 32\`)`);
}
