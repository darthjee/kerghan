import * as crypto from 'node:crypto';
import { inspect } from 'node:util';
import { EncryptedSecret, IntegrationsEncryptionService } from '../integrations-encryption.service.js';
import { integrationsKeySetOf } from '../integrations-key.js';
import { Secret } from '../secret.js';

const CANARY = 'ghp_CANARYcanary0000000000000000000000';
const BINDING = { uuid: '11111111-1111-4111-8111-111111111111', type: 'pat' };

/**
 * Builds the service with a fresh random key.
 * @returns {IntegrationsEncryptionService} The service under test.
 */
function buildService(): IntegrationsEncryptionService {
  const key = crypto.randomBytes(32);

  return new IntegrationsEncryptionService(integrationsKeySetOf(key));
}

/**
 * Flips the first byte of a buffer.
 * @param {Buffer} buffer - The buffer to tamper with.
 * @returns {Buffer} A tampered copy.
 */
function flipped(buffer: Buffer): Buffer {
  const copy = Buffer.from(buffer);
  copy[0] ^= 0xff;
  return copy;
}

describe('IntegrationsEncryptionService', () => {
  let service: IntegrationsEncryptionService;
  let encrypted: EncryptedSecret;

  beforeEach(() => {
    service = buildService();
    encrypted = service.encrypt(new Secret({ token: CANARY }), BINDING);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('round-trips a payload', () => {
    const decrypted = service.decrypt({ ...encrypted, ...BINDING });

    expect(decrypted).toBeInstanceOf(Secret);
    expect(decrypted?.reveal()).toEqual({ token: CANARY });
  });

  it('stores the configured key id, a 12-byte IV and a 16-byte tag, and no plaintext', () => {
    expect(encrypted.keyId).toBe(service.keyId);
    expect(encrypted.iv).toHaveLength(12);
    expect(encrypted.authTag).toHaveLength(16);
    expect(encrypted.ciphertext.toString('utf8')).not.toContain(CANARY);
    expect(inspect(encrypted)).not.toContain(CANARY);
  });

  it('uses a fresh IV for every encryption', () => {
    const again = service.encrypt(new Secret({ token: CANARY }), BINDING);

    expect(again.iv.equals(encrypted.iv)).toBe(false);
    expect(again.ciphertext.equals(encrypted.ciphertext)).toBe(false);
  });

  it.each([
    ['ciphertext', (row: EncryptedSecret): EncryptedSecret => ({ ...row, ciphertext: flipped(row.ciphertext) })],
    ['IV', (row: EncryptedSecret): EncryptedSecret => ({ ...row, iv: flipped(row.iv) })],
    ['auth tag', (row: EncryptedSecret): EncryptedSecret => ({ ...row, authTag: flipped(row.authTag) })],
  ])('answers null for a tampered %s', (_label, tamper) => {
    expect(service.decrypt({ ...tamper(encrypted), ...BINDING })).toBeNull();
  });

  it('answers null when the ciphertext is moved to another row (uuid)', () => {
    expect(service.decrypt({ ...encrypted, uuid: '22222222-2222-4222-8222-222222222222', type: 'pat' })).toBeNull();
  });

  it('answers null when the ciphertext is moved to another type', () => {
    expect(service.decrypt({ ...encrypted, uuid: BINDING.uuid, type: 'oauth_app' })).toBeNull();
  });

  it('answers null for a key-id mismatch without calling the decipher', () => {
    const spy = jest.spyOn(crypto, 'createDecipheriv');

    expect(service.decrypt({ ...encrypted, keyId: 'deadbeef', ...BINDING })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('answers null for a ciphertext from another key with a forged key id', () => {
    const other = buildService();
    const foreign = other.encrypt(new Secret({ token: CANARY }), BINDING);

    expect(service.decrypt({ ...foreign, keyId: service.keyId, ...BINDING })).toBeNull();
  });

  it('answers null when the plaintext is not JSON', () => {
    const key = crypto.randomBytes(32);
    const local = new IntegrationsEncryptionService(integrationsKeySetOf(key));
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(`${BINDING.uuid}:${BINDING.type}`, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update('not json', 'utf8'), cipher.final()]);

    expect(local.decrypt({ keyId: local.keyId, iv, authTag: cipher.getAuthTag(), ciphertext, ...BINDING }))
      .toBeNull();
  });

  it('reports whether a key id is decryptable', () => {
    expect(service.isDecryptableKeyId(service.keyId)).toBe(true);
    expect(service.isDecryptableKeyId('deadbeef')).toBe(false);
  });
});
