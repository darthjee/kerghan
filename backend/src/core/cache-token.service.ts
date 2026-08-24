import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Generates an HMAC-based cache token used to key Tent's proxy cache
 * per-user, so authenticated/user-scoped responses can carry a stable,
 * unguessable cache key without leaking one user's cached response to
 * another (see docs/agents/cache-warmer.md). Injected wherever a response
 * needs to expose the cache token — never reads the signing secret itself
 * outside DI.
 */
@Injectable()
export class CacheTokenService {
  private readonly configService: ConfigService;

  /**
   * @param {ConfigService} configService - Supplies the HMAC signing secret.
   */
  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  /**
   * Derives a per-user cache token.
   * @param {string|number} userId - The user's identifier.
   * @returns {string} A hex-encoded HMAC-SHA256 digest.
   */
  generate(userId: string | number): string {
    const secret = this.configService.get<string>('KERGHAN_SECRET_KEY', '');
    return createHmac('sha256', secret).update(String(userId)).digest('hex');
  }
}
