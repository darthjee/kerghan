import { Injectable } from '@nestjs/common';
import type { Integration } from './entities/integration.entity.js';
import { IntegrationCredentialAbuseGuardService } from './integration-credential-abuse-guard.service.js';
import { IntegrationCredentialError } from './integration-errors.js';
import { credentialLocked, flowUnsupported, httpErrorFor } from './integration-http-errors.js';
import { IntegrationsEncryptionService } from './integrations-encryption.service.js';
import type { Secret } from './secret.js';
import { IntegrationTypeRegistry } from './types/integration-type-registry.js';
import type { IntegrationTypeStrategy, ValidatedCredential } from './types/integration-type-strategy.js';

/** A credential parsed for a credential-paste type. */
export interface ParsedCredential {
  strategy: IntegrationTypeStrategy;
  secret: Secret;
}

/** The credential-derived columns written on create and on replace. */
export type SealedCredential = Pick<
  Integration,
  | 'githubLogin'
  | 'expiresAt'
  | 'metadata'
  | 'secretHint'
  | 'secretKeyId'
  | 'secretIv'
  | 'secretAuthTag'
  | 'secretCiphertext'
>;

/**
 * The credential pipeline shared by create and replace credential: flow
 * check and parsing, the failure cool-off around GitHub validation, and
 * sealing (mask + encrypt) of a validated credential. Never branches on
 * `type`: every type-specific step goes through the strategy.
 */
@Injectable()
export class IntegrationCredentialService {
  private readonly registry: IntegrationTypeRegistry;
  private readonly abuseGuard: IntegrationCredentialAbuseGuardService;
  private readonly encryption: IntegrationsEncryptionService;

  /**
   * @param {IntegrationTypeRegistry} registry - Resolves type strategies.
   * @param {IntegrationCredentialAbuseGuardService} abuseGuard - The per-user failure cool-off.
   * @param {IntegrationsEncryptionService} encryption - Encrypts the validated secret.
   */
  constructor(
    registry: IntegrationTypeRegistry,
    abuseGuard: IntegrationCredentialAbuseGuardService,
    encryption: IntegrationsEncryptionService,
  ) {
    this.registry = registry;
    this.abuseGuard = abuseGuard;
    this.encryption = encryption;
  }

  /**
   * Checks the type supports credential-paste and parses the credential into a `Secret`.
   * @param {string} type - The integration type.
   * @param {unknown} credential - The request's `credential` object.
   * @returns {ParsedCredential} The strategy and the wrapped secret.
   */
  parse(type: string, credential: unknown): ParsedCredential {
    const strategy = this.registry.find(type);

    if (strategy === undefined || !strategy.flows.credentialPaste) {
      throw flowUnsupported();
    }

    return { strategy, secret: strategy.parseCredential(credential) };
  }

  /**
   * Fails with 423 while the user is in the failure cool-off. A cheap early
   * check that keeps the spec'd order (before the cap and label checks); the
   * atomic gate is the reservation in `validate`.
   * @param {number} userId - The caller's id.
   * @returns {Promise<void>} Resolves when not locked out.
   */
  async assertNotLocked(userId: number): Promise<void> {
    if (await this.abuseGuard.isLockedOut(userId)) {
      throw credentialLocked();
    }
  }

  /**
   * Validates the credential against GitHub. An attempt is atomically
   * reserved in the cool-off first (423 when refused, so parallel requests
   * can't exceed the limit); a counted failure keeps it, a success resets
   * the cool-off, and anything else releases it. Domain errors become HTTP
   * errors.
   * @param {number} userId - The caller's id.
   * @param {ParsedCredential} parsed - The strategy and the secret.
   * @returns {Promise<ValidatedCredential>} The validated credential.
   */
  async validate(userId: number, { strategy, secret }: ParsedCredential): Promise<ValidatedCredential> {
    if (!(await this.abuseGuard.reserveAttempt(userId))) {
      throw credentialLocked();
    }

    let validated: ValidatedCredential;

    try {
      validated = await strategy.validate(secret);
    } catch (error) {
      throw await this.settleFailure(userId, error);
    }

    await this.abuseGuard.reset(userId);

    return validated;
  }

  /**
   * Builds the credential-derived columns: normalised metadata, hint and ciphertext bound to the row.
   * @param {IntegrationTypeStrategy} strategy - The type's strategy.
   * @param {ValidatedCredential} validated - The validated credential.
   * @param {string} uuid - The row's uuid (part of the AAD).
   * @returns {SealedCredential} The columns to write.
   */
  seal(strategy: IntegrationTypeStrategy, validated: ValidatedCredential, uuid: string): SealedCredential {
    const encrypted = this.encryption.encrypt(validated.secret, { uuid, type: strategy.type });

    return {
      githubLogin: validated.githubLogin,
      expiresAt: validated.expiresAt,
      metadata: strategy.describeMetadata(validated.metadata),
      secretHint: strategy.mask(validated.secret),
      secretKeyId: encrypted.keyId,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretCiphertext: encrypted.ciphertext,
    };
  }

  /**
   * Settles the reservation of a failed validation (kept for a counted
   * failure, released otherwise) and maps a domain error to HTTP; anything
   * else passes through.
   * @param {number} userId - The caller's id.
   * @param {unknown} error - The caught value.
   * @returns {Promise<unknown>} The error to throw.
   */
  private async settleFailure(userId: number, error: unknown): Promise<unknown> {
    const isDomainError = error instanceof IntegrationCredentialError;

    if (!isDomainError || !error.countsTowardCoolOff) {
      await this.abuseGuard.releaseAttempt(userId);
    }

    return isDomainError ? httpErrorFor(error) : error;
  }
}
