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
 * Encrypts and decrypts integration secret payloads with AES-256-GCM under
 * `KERGHAN_INTEGRATIONS_KEY`. The plaintext is the JSON serialisation of the
 * payload; it exists as a string only inside this service.
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
   * The id of the configured key, stored with every new ciphertext.
   * @returns {string} The 8-character key id.
   */
  get keyId(): string {
    return this.integrationsKey.current.keyId;
  }

  /**
   * Encrypts a secret payload, bound to its row.
   * @param {Secret} secret - The payload to encrypt (serialised as JSON).
   * @param {SecretBinding} binding - The row's uuid and type, used as AAD.
   * @returns {EncryptedSecret} The key id, fresh IV, auth tag and ciphertext.
   */
  encrypt(secret: Secret, binding: SecretBinding): EncryptedSecret {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.integrationsKey.current.key, iv, { authTagLength: AUTH_TAG_BYTES });
    cipher.setAAD(aadFor(binding));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(secret.reveal()), 'utf8'), cipher.final()]);

    return { keyId: this.keyId, iv, authTag: cipher.getAuthTag(), ciphertext };
  }

  /**
   * Decrypts a stored secret. Never throws and never logs: an unknown key id
   * (checked before any crypto), an auth-tag failure or unparseable JSON all
   * answer `null` (undecryptable).
   * @param {EncryptedSecret & SecretBinding} row - The stored columns and the row's binding.
   * @returns {Secret | null} The decrypted payload, or `null` when undecryptable.
   */
  decrypt(row: EncryptedSecret & SecretBinding): Secret | null {
    if (!this.isDecryptableKeyId(row.keyId)) {
      return null;
    }

    try {
      const decipher = createDecipheriv(ALGORITHM, this.integrationsKey.current.key, row.iv, { authTagLength: AUTH_TAG_BYTES });
      decipher.setAAD(aadFor(row));
      decipher.setAuthTag(row.authTag);
      const plaintext = Buffer.concat([decipher.update(row.ciphertext), decipher.final()]).toString('utf8');

      return new Secret<unknown>(JSON.parse(plaintext));
    } catch {
      return null;
    }
  }

  /**
   * Whether a stored key id matches a configured key (compared without decrypting).
   * @param {string} keyId - The stored `secret_key_id`.
   * @returns {boolean} `true` when the configured key produced it.
   */
  isDecryptableKeyId(keyId: string): boolean {
    return keyId === this.integrationsKey.current.keyId;
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
