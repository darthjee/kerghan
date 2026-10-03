import { HttpException } from '@nestjs/common';
import {
  CredentialInvalidError,
  GithubRateLimitedError,
  GithubUnavailableError,
  InstallationNotAccessibleError,
  InstallationSuspendedError,
  InsufficientPermissionsError,
  IntegrationCredentialError,
} from '../integration-errors.js';
import { httpErrorFor } from '../integration-http-errors.js';

/**
 * Maps an error and returns its status and body.
 * @param {IntegrationCredentialError} error - The domain error.
 * @returns {{ status: number, body: unknown }} The HTTP answer.
 */
function answer(error: IntegrationCredentialError): { status: number; body: unknown } {
  const http: HttpException = httpErrorFor(error);

  return { status: http.getStatus(), body: http.getResponse() };
}

describe('httpErrorFor', () => {
  it.each([
    [new CredentialInvalidError(), 422, 'INTEGRATION_CREDENTIAL_INVALID'],
    [new InsufficientPermissionsError('missing'), 422, 'INTEGRATION_INSUFFICIENT_PERMISSIONS'],
    [new InstallationNotAccessibleError(), 422, 'INTEGRATION_INSTALLATION_NOT_ACCESSIBLE'],
    [new InstallationSuspendedError(), 422, 'INTEGRATION_INSTALLATION_SUSPENDED'],
    [new GithubRateLimitedError(30), 503, 'GITHUB_RATE_LIMITED'],
    [new GithubUnavailableError(), 502, 'GITHUB_UNAVAILABLE'],
  ])('maps %p to %i %s', (error, status, code) => {
    const { status: actual, body } = answer(error);

    expect(actual).toBe(status);
    expect(body).toEqual(expect.objectContaining({ code }));
  });

  it.each([
    [new InstallationNotAccessibleError(), true],
    [new InstallationSuspendedError(), true],
  ])('counts %p toward the cool-off', (error, counted) => {
    expect(error.countsTowardCoolOff).toBe(counted);
  });
});
