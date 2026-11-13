import { Injectable } from '@nestjs/common';
import type { Integration } from './entities/integration.entity.js';
import { GithubInstallationTokenCache } from './github-installation-token-cache.js';

/**
 * What happens inside the Integrations module once an integration's
 * credential is replaced or the integration is deleted: the cached GitHub
 * App installation token is evicted, so a token minted with the old
 * credential is never reused.
 */
@Injectable()
export class IntegrationLifecycleService {
  /**
   * @param {GithubInstallationTokenCache} tokenCache - The installation-token cache.
   */
  constructor(private readonly tokenCache: GithubInstallationTokenCache) {}

  /**
   * Runs after a credential replacement was stored.
   * @param {Pick<Integration, 'id'>} row - The updated row.
   * @returns {void}
   */
  credentialReplaced(row: Pick<Integration, 'id'>): void {
    this.tokenCache.evict(row.id);
  }

  /**
   * Runs after an integration's row delete committed.
   * @param {Pick<Integration, 'id' | 'userId'>} row - The deleted row.
   * @returns {Promise<void>} Resolves once every hook ran.
   */
  async deleted(row: Pick<Integration, 'id' | 'userId'>): Promise<void> {
    this.tokenCache.evict(row.id);
  }
}
