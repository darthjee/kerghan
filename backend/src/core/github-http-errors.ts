import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodes } from './error-codes.js';

/**
 * 502 `GITHUB_UNAVAILABLE`.
 * @returns {HttpException} The exception.
 */
export function githubUnavailable(): HttpException {
  return new HttpException(
    { code: ErrorCodes.GITHUB_UNAVAILABLE, message: 'GitHub is unavailable; try again later' },
    HttpStatus.BAD_GATEWAY,
  );
}

/**
 * 503 `GITHUB_RATE_LIMITED`, with a `Retry-After` header when GitHub gave a delay.
 * @param {number} [retryAfterSeconds] - Seconds until GitHub accepts calls again.
 * @returns {HttpException} The exception.
 */
export function githubRateLimited(retryAfterSeconds?: number): HttpException {
  return new HttpException(
    {
      code: ErrorCodes.GITHUB_RATE_LIMITED,
      message: 'GitHub rate limit reached; try again later',
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    },
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}
