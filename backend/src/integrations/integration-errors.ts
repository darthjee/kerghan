/**
 * Domain errors a type strategy throws while validating a credential
 * against GitHub. They carry only safe data (never the credential, never
 * GitHub's raw answer) and are mapped to HTTP in the service layer
 * (`integration-http-errors.ts`), not in the strategy.
 */
export abstract class IntegrationCredentialError extends Error {
  /** Whether this failure counts toward the create/replace failure cool-off. */
  abstract readonly countsTowardCoolOff: boolean;
}

/** GitHub rejected the credential (e.g. a 401). Counted toward the cool-off. */
export class CredentialInvalidError extends IntegrationCredentialError {
  readonly countsTowardCoolOff = true;

  /**
   * Builds the error with a fixed, safe message.
   */
  constructor() {
    super('GitHub rejected the credential');
    this.name = 'CredentialInvalidError';
  }
}

/** The credential lacks the required scopes/permissions. Counted toward the cool-off. */
export class InsufficientPermissionsError extends IntegrationCredentialError {
  readonly countsTowardCoolOff = true;

  /**
   * @param {string} message - Safe, user-facing description of what is missing.
   */
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientPermissionsError';
  }
}

/**
 * The claimed or selected GitHub App installation isn't among those the
 * user proved access to (or doesn't exist, or belongs to another app). The
 * same message in every case, so nothing leaks. Counted toward the cool-off.
 */
export class InstallationNotAccessibleError extends IntegrationCredentialError {
  readonly countsTowardCoolOff = true;

  /**
   * Builds the error with a fixed, safe message.
   */
  constructor() {
    super('Your GitHub account cannot access that installation of the GitHub App');
    this.name = 'InstallationNotAccessibleError';
  }
}

/** The GitHub App installation is suspended. Counted toward the cool-off. */
export class InstallationSuspendedError extends IntegrationCredentialError {
  readonly countsTowardCoolOff = true;

  /**
   * Builds the error with a fixed, safe message.
   */
  constructor() {
    super('This installation is suspended on GitHub');
    this.name = 'InstallationSuspendedError';
  }
}

/** GitHub was unreachable, timed out, answered 5xx or something unexpected. Not counted. */
export class GithubUnavailableError extends IntegrationCredentialError {
  readonly countsTowardCoolOff = false;

  /**
   * Builds the error with a fixed, safe message.
   */
  constructor() {
    super('GitHub is unavailable');
    this.name = 'GithubUnavailableError';
  }
}

/** GitHub's rate limit was hit. Not counted. */
export class GithubRateLimitedError extends IntegrationCredentialError {
  readonly countsTowardCoolOff = false;
  readonly retryAfterSeconds: number | undefined;

  /**
   * @param {number} [retryAfterSeconds] - Seconds until GitHub accepts calls again, when known.
   */
  constructor(retryAfterSeconds?: number) {
    super('GitHub rate limit reached');
    this.name = 'GithubRateLimitedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** A type's metadata failed its own shape validation (a programming error, never user input). */
export class InvalidMetadataError extends Error {
  /**
   * @param {string} type - The integration type whose metadata is invalid.
   */
  constructor(type: string) {
    super(`invalid ${type} integration metadata`);
    this.name = 'InvalidMetadataError';
  }
}
