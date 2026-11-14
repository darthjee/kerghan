import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '../core/logger.service.js';
import type { Integration } from './entities/integration.entity.js';
import { INTEGRATION_DELETED, IntegrationDeletedEvent } from './events/integration-deleted.event.js';
import { GithubInstallationTokenCache } from './github-installation-token-cache.js';

/**
 * What happens once an integration's credential is replaced or the
 * integration is deleted: the cached GitHub App installation token is
 * evicted (so a token minted with the old credential is never reused), and a
 * delete emits the awaited `integration.deleted` event.
 */
@Injectable()
export class IntegrationLifecycleService {
  /**
   * @param {GithubInstallationTokenCache} tokenCache - The installation-token cache.
   * @param {EventEmitter2} eventEmitter - Emits `integration.deleted`.
   * @param {LoggerService} logger - Logs a listener failure with safe fields only.
   */
  constructor(
    private readonly tokenCache: GithubInstallationTokenCache,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Runs after a credential replacement was stored.
   * @param {Pick<Integration, 'id'>} row - The updated row.
   * @returns {void}
   */
  credentialReplaced(row: Pick<Integration, 'id'>): void {
    this.tokenCache.evict(row.id);
  }

  /**
   * Runs after an integration's row delete committed: evicts its cached
   * token, then emits and awaits `integration.deleted`. A listener failure
   * is logged and swallowed, so the delete still succeeds.
   * @param {Pick<Integration, 'id' | 'userId'>} row - The deleted row.
   * @returns {Promise<void>} Resolves once the listeners settled.
   */
  async deleted(row: Pick<Integration, 'id' | 'userId'>): Promise<void> {
    this.tokenCache.evict(row.id);

    try {
      await this.eventEmitter.emitAsync(INTEGRATION_DELETED, new IntegrationDeletedEvent(row.userId, row.id));
    } catch (error) {
      this.logger.warn('integration.deleted listener failed', {
        integrationId: row.id,
        userId: row.userId,
        error: error instanceof Error ? error.name : typeof error,
      });
    }
  }
}
