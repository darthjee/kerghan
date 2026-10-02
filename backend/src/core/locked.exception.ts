import { HttpException } from '@nestjs/common';

// The installed `@nestjs/common` version's `HttpStatus` enum has no `LOCKED`
// member, so the status code is applied literally here.
export const HTTP_STATUS_LOCKED = 423;

/**
 * `423 Locked` — the target resource is temporarily locked (e.g. a
 * brute-force cool-off lockout). The global exception filter maps it to the
 * `LOCKED` category code, or to the specific `code` when one is given.
 */
export class LockedException extends HttpException {
  /**
   * @param {string} message - Human-readable reason for the lock.
   * @param {string} [code] - Optional specific error code (e.g. `INTEGRATION_CREDENTIAL_LOCKED`).
   */
  constructor(message: string, code?: string) {
    super(code === undefined ? message : { code, message }, HTTP_STATUS_LOCKED);
  }
}
