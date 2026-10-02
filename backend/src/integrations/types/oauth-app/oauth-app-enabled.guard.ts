import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { OauthAppStrategy } from './oauth-app.strategy.js';

/**
 * Answers 404 `NOT_FOUND` on the OAuth App routes while the type is
 * disabled, as if they didn't exist. As a controller-level guard it runs
 * after the global guards (auth and CSRF) and before body validation, the
 * order the spec requires.
 */
@Injectable()
export class OauthAppEnabledGuard implements CanActivate {
  private readonly strategy: OauthAppStrategy;

  /**
   * @param {OauthAppStrategy} strategy - Knows whether the type is enabled.
   */
  constructor(strategy: OauthAppStrategy) {
    this.strategy = strategy;
  }

  /**
   * @returns {boolean} `true` when the type is enabled; throws 404 otherwise.
   */
  canActivate(): boolean {
    if (!this.strategy.isEnabled()) {
      throw new NotFoundException();
    }

    return true;
  }
}
