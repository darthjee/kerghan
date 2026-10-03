import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CredentialInvalidError,
  GithubRateLimitedError,
  InstallationNotAccessibleError,
  InstallationSuspendedError,
  InsufficientPermissionsError,
  IntegrationCredentialError,
} from './integration-errors.js';
import { ErrorCodes } from '../core/error-codes.js';
import { LockedException } from '../core/locked.exception.js';

// Same message for a missing, foreign or malformed uuid, so existence never leaks.
export const INTEGRATION_NOT_FOUND_MESSAGE = 'Integration not found';

/**
 * The 404 answered for a missing, foreign or malformed integration uuid.
 * @returns {NotFoundException} The exception.
 */
export function integrationNotFound(): NotFoundException {
  return new NotFoundException(INTEGRATION_NOT_FOUND_MESSAGE);
}

/**
 * 400 `INTEGRATION_FLOW_UNSUPPORTED`: the type can't be created from a pasted credential here.
 * @returns {BadRequestException} The exception.
 */
export function flowUnsupported(): BadRequestException {
  return new BadRequestException({
    code: ErrorCodes.INTEGRATION_FLOW_UNSUPPORTED,
    message: 'This integration type does not support pasting a credential',
  });
}

/**
 * 409 `INTEGRATION_LABEL_TAKEN`.
 * @returns {ConflictException} The exception.
 */
export function labelTaken(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.INTEGRATION_LABEL_TAKEN,
    message: 'label is already used by another integration',
  });
}

/**
 * 409 `INTEGRATIONS_LIMIT_REACHED`.
 * @returns {ConflictException} The exception.
 */
export function limitReached(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.INTEGRATIONS_LIMIT_REACHED,
    message: 'Integration limit reached',
  });
}

/**
 * 423 `INTEGRATION_CREDENTIAL_LOCKED`.
 * @returns {LockedException} The exception.
 */
export function credentialLocked(): LockedException {
  return new LockedException(
    'Too many rejected credentials; try again later',
    ErrorCodes.INTEGRATION_CREDENTIAL_LOCKED,
  );
}

/**
 * 429 `INTEGRATION_TEST_COOLDOWN`, with a `Retry-After` header.
 * @param {number} retryAfterSeconds - Seconds until the next test is allowed.
 * @returns {HttpException} The exception.
 */
export function testCooldown(retryAfterSeconds: number): HttpException {
  return new HttpException(
    {
      code: ErrorCodes.INTEGRATION_TEST_COOLDOWN,
      message: 'This integration was tested recently; try again later',
      retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

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

/**
 * Maps a strategy's domain error to its HTTP answer (never echoing GitHub's raw answer).
 * @param {IntegrationCredentialError} error - The domain error.
 * @returns {HttpException} The HTTP exception to throw.
 */
export function httpErrorFor(error: IntegrationCredentialError): HttpException {
  if (error instanceof CredentialInvalidError) {
    return new UnprocessableEntityException({
      code: ErrorCodes.INTEGRATION_CREDENTIAL_INVALID,
      message: 'GitHub rejected the credential',
    });
  }

  if (error instanceof InsufficientPermissionsError) {
    return new UnprocessableEntityException({
      code: ErrorCodes.INTEGRATION_INSUFFICIENT_PERMISSIONS,
      message: error.message,
    });
  }

  if (error instanceof InstallationNotAccessibleError) {
    return new UnprocessableEntityException({
      code: ErrorCodes.INTEGRATION_INSTALLATION_NOT_ACCESSIBLE,
      message: error.message,
    });
  }

  if (error instanceof InstallationSuspendedError) {
    return new UnprocessableEntityException({
      code: ErrorCodes.INTEGRATION_INSTALLATION_SUSPENDED,
      message: error.message,
    });
  }

  if (error instanceof GithubRateLimitedError) {
    return githubRateLimited(error.retryAfterSeconds);
  }

  return githubUnavailable();
}

/**
 * 400 `INTEGRATION_REDIRECT_STATE_INVALID`: the same answer for an unknown,
 * expired, used, foreign or wrong `state` (never echoing it).
 * @returns {BadRequestException} The exception.
 */
export function invalidRedirectState(): BadRequestException {
  return new BadRequestException({
    code: ErrorCodes.INTEGRATION_REDIRECT_STATE_INVALID,
    message: 'This GitHub authorization link expired or was already used',
  });
}
