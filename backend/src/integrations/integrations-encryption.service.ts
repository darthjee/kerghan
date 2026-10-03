import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { INTEGRATIONS_KEY, IntegrationsKey } from './integrations-key.js';
import { Secret } from './secret.js';

const ALGORITHM = 'aes-256-gcm';
// 96-bit IV, fresh for every encryption.
const IV_BYTES = 12;
// 128-bit authentication tag.
const AUTH_TAG_BYTES = 16;

/**
 * What a ciphertext is bound to through AES-GCM additional authenticated
 * data (`"<uuid>:<type>"`), so it can't be moved to another row.
 */
export interface SecretBinding {
  uuid: string;
  type: string;
}

/**
 * The four stored columns of an encrypted secret.
 */
export interface EncryptedSecret {
  keyId: string;
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
}

/**
 * Encrypts and decrypts integration secret payloads with AES-256-GCM. New
 * ciphertexts always use the current `KERGHAN_INTEGRATIONS_KEY`; stored rows
 * are decrypted with whichever configured key (current or one of
 * `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS`) their `secret_key_id` names. The
 * plaintext is the JSON serialisation of the payload; it exists as a string
 * only inside this service.
 */
@Injectable()
export class IntegrationsEncryptionService {
  private readonly integrationsKey: IntegrationsKey;

  /**
   * @param {IntegrationsKey} integrationsKey - The validated key set, built at boot.
   */
  constructor(@Inject(INTEGRATIONS_KEY) integrationsKey: IntegrationsKey) {
    this.integrationsKey = integrationsKey;
  }

  /**
   * The id of the current key, stored with every new ciphertext.
   * @returns {string} The 8-character key id.
   */
  get keyId(): string {
    return this.integrationsKey.current.keyId;
  }

  /**
   * The id of the current key (alias of `keyId`, for rotation queries).
   * @returns {string} The 8-character key id.
   */
  get currentKeyId(): string {
    return this.integrationsKey.current.keyId;
  }

  /**
   * The ids of the previous (decrypt-only) keys, in configured order.
   * @returns {string[]} The 8-character key ids.
   */
  get previousKeyIds(): string[] {
    return this.integrationsKey.previous.map((entry) => entry.keyId);
  }

  /**
   * Encrypts a secret payload under the current key, bound to its row.
   * @param {Secret} secret - The payload to encrypt (serialised as JSON).
   * @param {SecretBinding} binding - The row's uuid and type, used as AAD.
   * @returns {EncryptedSecret} The key id, fresh IV, auth tag and ciphertext.
   */
  encrypt(secret: Secret, binding: SecretBinding): EncryptedSecret {
    return this.#encryptBuffer(Buffer.from(JSON.stringify(secret.reveal()), 'utf8'), binding);
  }

  /**
   * Decrypts a stored secret with the key its key id names. Never throws and
   * never logs: an unknown key id (checked before any crypto), an auth-tag
   * failure or unparseable JSON all answer `null` (undecryptable).
   * @param {EncryptedSecret & SecretBinding} row - The stored columns and the row's binding.
   * @returns {Secret | null} The decrypted payload, or `null` when undecryptable.
   */
  decrypt(row: EncryptedSecret & SecretBinding): Secret | null {
    const plaintext = this.#decryptBuffer(row);

    if (plaintext === null) {
      return null;
    }

    try {
      return new Secret<unknown>(JSON.parse(plaintext.toString('utf8')));
    } catch {
      return null;
    }
  }

  /**
   * Re-encrypts a stored secret under the current key: decrypts it with the
   * key its key id names, then encrypts the same plaintext bytes with a fresh
   * IV and the same AAD. The plaintext never leaves the service. Never throws.
   * @param {EncryptedSecret & SecretBinding} row - The stored columns and the row's binding.
   * @returns {EncryptedSecret | null} The new columns, or `null` when undecryptable.
   */
  reencrypt(row: EncryptedSecret & SecretBinding): EncryptedSecret | null {
    const plaintext = this.#decryptBuffer(row);

    if (plaintext === null) {
      return null;
    }

    try {
      return this.#encryptBuffer(plaintext, row);
    } finally {
      plaintext.fill(0);
    }
  }

  /**
   * Whether a stored key id matches a configured key, current or previous
   * (compared without decrypting).
   * @param {string} keyId - The stored `secret_key_id`.
   * @returns {boolean} `true` when a configured key produced it.
   */
  isDecryptableKeyId(keyId: string): boolean {
    return this.integrationsKey.byId.has(keyId);
  }

  /**
   * Whether a stored key id is the current key's.
   * @param {string} keyId - The stored `secret_key_id`.
   * @returns {boolean} `true` when the current key produced it.
   */
  isCurrentKeyId(keyId: string): boolean {
    return keyId === this.integrationsKey.current.keyId;
  }

  /**
   * Whether a stored key id is one of the previous (decrypt-only) keys'.
   * @param {string} keyId - The stored `secret_key_id`.
   * @returns {boolean} `true` when a previous key produced it.
   */
  isPreviousKeyId(keyId: string): boolean {
    return this.isDecryptableKeyId(keyId) && !this.isCurrentKeyId(keyId);
  }

  /**
   * Encrypts raw plaintext bytes under the current key.
   * @param {Buffer} plaintext - The plaintext bytes.
   * @param {SecretBinding} binding - The row's uuid and type, used as AAD.
   * @returns {EncryptedSecret} The key id, fresh IV, auth tag and ciphertext.
   */
  #encryptBuffer(plaintext: Buffer, binding: SecretBinding): EncryptedSecret {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.integrationsKey.current.key, iv, { authTagLength: AUTH_TAG_BYTES });
    cipher.setAAD(aadFor(binding));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    return { keyId: this.keyId, iv, authTag: cipher.getAuthTag(), ciphertext };
  }

  /**
   * Decrypts a stored secret into raw bytes with the key its key id names.
   * @param {EncryptedSecret & SecretBinding} row - The stored columns and the row's binding.
   * @returns {Buffer | null} The plaintext bytes, or `null` for an unknown key id or a crypto failure.
   */
  #decryptBuffer(row: EncryptedSecret & SecretBinding): Buffer | null {
    const key = this.integrationsKey.byId.get(row.keyId);

    if (key === undefined) {
      return null;
    }

    try {
      const decipher = createDecipheriv(ALGORITHM, key, row.iv, { authTagLength: AUTH_TAG_BYTES });
      decipher.setAAD(aadFor(row));
      decipher.setAuthTag(row.authTag);

      return Buffer.concat([decipher.update(row.ciphertext), decipher.final()]);
    } catch {
      return null;
    }
  }
}

/**
 * Builds the AES-GCM additional authenticated data for a row.
 * @param {SecretBinding} binding - The row's uuid and type.
 * @returns {Buffer} UTF-8 bytes of `"<uuid>:<type>"`.
 */
function aadFor(binding: SecretBinding): Buffer {
  return Buffer.from(`${binding.uuid}:${binding.type}`, 'utf8');
}
