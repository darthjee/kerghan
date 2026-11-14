import { ConflictException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '../core/error-codes.js';

// Same message for a missing, foreign or GitHub-denied repository, so existence never leaks.
export const REPOSITORY_NOT_FOUND_MESSAGE = 'Repository not found';

/**
 * 404 `NOT_FOUND`: the single answer for every Add `404` (missing, another user's, denied by
 * GitHub, or pruned meanwhile), so every body is identical.
 * @returns {NotFoundException} The exception.
 */
export function repositoryNotFound(): NotFoundException {
  return new NotFoundException(REPOSITORY_NOT_FOUND_MESSAGE);
}

/**
 * 409 `REPOSITORY_SOURCE_UNUSABLE`: no usable candidate could re-check the repository.
 * @returns {ConflictException} The exception.
 */
export function repositorySourceUnusable(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.REPOSITORY_SOURCE_UNUSABLE,
    message: 'The integration that sees this repository needs attention.',
  });
}

/**
 * 429 `REPOSITORY_REFRESH_COOLDOWN`, with `Retry-After` and `error.retryAfterSeconds`.
 * @param {number} retryAfterSeconds - Seconds until a Refresh is allowed again.
 * @returns {HttpException} The exception.
 */
export function refreshCooldown(retryAfterSeconds: number): HttpException {
  return new HttpException(
    {
      code: ErrorCodes.REPOSITORY_REFRESH_COOLDOWN,
      message: 'Repositories were synced recently; try again later',
      retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/**
 * 429 `REPOSITORY_ADD_RATE_LIMITED`, with `Retry-After` and `error.retryAfterSeconds`.
 * @param {number} retryAfterSeconds - Seconds until the user's Add window resets.
 * @returns {HttpException} The exception.
 */
export function addRateLimited(retryAfterSeconds: number): HttpException {
  return new HttpException(
    {
      code: ErrorCodes.REPOSITORY_ADD_RATE_LIMITED,
      message: 'Too many repositories added; try again later',
      retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
