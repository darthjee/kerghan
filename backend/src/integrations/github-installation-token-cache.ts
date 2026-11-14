import { Injectable } from '@nestjs/common';
import type { InstallationTokenMint } from './github-repo-response.js';
import { IntegrationStoreService } from './integration-store.service.js';
import type { Secret } from './secret.js';
import { Clock } from '../core/clock.js';

// A cached installation token is reused until this long before its `expires_at`.
export const INSTALLATION_TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

/** What a token is minted for: the integration, its installation and the credential used. */
export interface InstallationTokenKey {
  /** The internal `integrations.id` (the cache key). */
  integrationId: number;
  userId: number;
  installationId: number;
  /** The `secret_iv` of the credential the mint uses. Never leaves the module. */
  ivUsed: Buffer;
}

/**
 * A token to call with (`fresh` when minted for this call, not reused from
 * the cache), or why none could be minted.
 */
export type InstallationTokenAnswer =
  | { kind: 'token'; token: Secret<string>; fresh: boolean }
  | Exclude<InstallationTokenMint, { kind: 'ok' }>;

interface CachedToken {
  installationId: number;
  ivUsed: Buffer;
  token: Secret<string>;
  expiresAt: Date;
}

interface InFlightMint {
  installationId: number;
  ivUsed: Buffer;
  promise: Promise<InstallationTokenMint>;
}

/**
 * The in-memory GitHub App installation-token cache (see
 * `docs/agents/modules/integrations/github-service.md#github-app-installation-tokens`).
 * Internal to the Integrations module and never exported; it has no getter
 * for a token outside `acquire`, and logs nothing.
 *
 * - Keyed by `integrations.id`; an entry is reused until `expires_at` − 5 min
 *   (read from the injected `Clock`), and dropped on read once past it.
 * - Single-flight: concurrent callers for one integration share one mint.
 * - Replace guard: a finished mint is cached only when the integration still
 *   holds the `secret_iv` it was minted with, and no eviction happened while
 *   it was in flight; otherwise it serves its own callers only.
 */
@Injectable()
export class GithubInstallationTokenCache {
  readonly #entries = new Map<number, CachedToken>();
  readonly #inFlight = new Map<number, InFlightMint>();
  readonly #generations = new Map<number, number>();

  /**
   * @param {Clock} clock - The time source, for the expiry check.
   * @param {IntegrationStoreService} store - Re-reads the current `secret_iv` after a mint.
   */
  constructor(
    private readonly clock: Clock,
    private readonly store: IntegrationStoreService,
  ) {}

  /**
   * Answers a cached token when one is still valid for this credential,
   * else joins the in-flight mint or starts one with `mint`.
   * @param {InstallationTokenKey} key - The integration, installation and credential IV.
   * @param {() => Promise<InstallationTokenMint>} mint - Mints a token (only called on a miss).
   * @returns {Promise<InstallationTokenAnswer>} The token to call with, or the mint failure.
   */
  async acquire(key: InstallationTokenKey, mint: () => Promise<InstallationTokenMint>): Promise<InstallationTokenAnswer> {
    const cached = this.#cached(key);

    if (cached !== null) {
      return { kind: 'token', token: cached, fresh: false };
    }

    const minted = await this.#joinOrMint(key, mint);

    return minted.kind === 'ok' ? { kind: 'token', token: minted.token, fresh: true } : minted;
  }

  /**
   * Drops the integration's cached token, and keeps any mint in flight from
   * being cached (on a `401`, on delete, on replace credential).
   * @param {number} integrationId - The internal `integrations.id`.
   * @returns {void}
   */
  evict(integrationId: number): void {
    this.#entries.delete(integrationId);
    this.#inFlight.delete(integrationId);
    this.#generations.set(integrationId, this.#generation(integrationId) + 1);
  }

  /**
   * Reads a still-valid cached token, dropping a stale or mismatched one.
   * @param {InstallationTokenKey} key - The lookup.
   * @returns {Secret<string> | null} The token, or `null` on a miss.
   */
  #cached(key: InstallationTokenKey): Secret<string> | null {
    const entry = this.#entries.get(key.integrationId);

    if (entry === undefined) {
      return null;
    }

    const usable = matchesKey(entry, key)
      && this.clock.now().getTime() < entry.expiresAt.getTime() - INSTALLATION_TOKEN_EXPIRY_MARGIN_MS;

    if (!usable) {
      this.#entries.delete(key.integrationId);
      return null;
    }

    return entry.token;
  }

  /**
   * Joins the in-flight mint for the same credential, or starts one.
   * @param {InstallationTokenKey} key - The lookup.
   * @param {() => Promise<InstallationTokenMint>} mint - Mints a token.
   * @returns {Promise<InstallationTokenMint>} The mint's outcome.
   */
  #joinOrMint(key: InstallationTokenKey, mint: () => Promise<InstallationTokenMint>): Promise<InstallationTokenMint> {
    const inFlight = this.#inFlight.get(key.integrationId);

    if (inFlight !== undefined && matchesKey(inFlight, key)) {
      return inFlight.promise;
    }

    const generation = this.#generation(key.integrationId);
    const promise = mint().then(async (minted) => {
      if (minted.kind === 'ok') {
        await this.#cacheIfCurrent(key, generation, minted);
      }

      return minted;
    }).finally(() => {
      if (this.#inFlight.get(key.integrationId)?.promise === promise) {
        this.#inFlight.delete(key.integrationId);
      }
    });

    this.#inFlight.set(key.integrationId, { installationId: key.installationId, ivUsed: key.ivUsed, promise });

    return promise;
  }

  /**
   * Caches a minted token only when no eviction happened meanwhile and the
   * integration still holds the credential it was minted with.
   * @param {InstallationTokenKey} key - The mint's key.
   * @param {number} generation - The eviction generation when the mint started.
   * @param {{ token: Secret<string>, expiresAt: Date }} minted - The minted token.
   * @returns {Promise<void>} Resolves once cached (or skipped).
   */
  async #cacheIfCurrent(
    key: InstallationTokenKey,
    generation: number,
    minted: { token: Secret<string>; expiresAt: Date },
  ): Promise<void> {
    const currentIv = await this.store.readSecretIv(key.userId, key.integrationId);

    if (currentIv === null || !currentIv.equals(key.ivUsed) || this.#generation(key.integrationId) !== generation) {
      return;
    }

    this.#entries.set(key.integrationId, {
      installationId: key.installationId,
      ivUsed: key.ivUsed,
      token: minted.token,
      expiresAt: minted.expiresAt,
    });
  }

  /**
   * @param {number} integrationId - The internal `integrations.id`.
   * @returns {number} How many evictions it has seen.
   */
  #generation(integrationId: number): number {
    return this.#generations.get(integrationId) ?? 0;
  }
}

/**
 * Whether an entry was minted for the same installation and credential.
 * @param {{ installationId: number, ivUsed: Buffer }} entry - The cached or in-flight entry.
 * @param {InstallationTokenKey} key - The lookup.
 * @returns {boolean} `true` when it matches.
 */
function matchesKey(entry: { installationId: number; ivUsed: Buffer }, key: InstallationTokenKey): boolean {
  return entry.installationId === key.installationId && entry.ivUsed.equals(key.ivUsed);
}
