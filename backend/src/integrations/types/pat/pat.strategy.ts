import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../core/logger.service.js';
import { fetchGithubUser, GithubUserAnswer } from '../../github-answer.js';
import { GithubClientService, GithubUserResponse } from '../../github-client.service.js';
import { STATUS_REASON_INSUFFICIENT_PERMISSIONS } from '../../integration-enums.js';
import {
  CredentialInvalidError,
  GithubRateLimitedError,
  GithubUnavailableError,
  InsufficientPermissionsError,
} from '../../integration-errors.js';
import { Secret } from '../../secret.js';
import {
  IntegrationFlows,
  IntegrationTypeStrategy,
  IntegrationView,
  TestOutcome,
  TypeMetadata,
  ValidatedCredential,
} from '../integration-type-strategy.js';
import {
  maskPatToken,
  parsePatCredential,
  parsePatPayload,
  PatPayload,
  PatTokenKind,
  tokenKindOf,
} from './pat-credential.js';
import { buildPatMetadata, describePatMetadata, parseExpiration, PatMetadata } from './pat-metadata.js';

/** `invalid` reason for a 401 on a token not known to be expired. */
export const PAT_REASON_BAD_CREDENTIALS = 'bad_credentials';

// The classic scope required to read private repositories.
const REQUIRED_CLASSIC_SCOPE = 'repo';

/** What a 200 from `GET /user` yields for a PAT. */
interface PatIdentity {
  githubLogin: string;
  expiresAt: Date | null;
  metadata: PatMetadata;
}

/**
 * The Personal Access Token (`pat`) type: the user pastes a classic
 * (`ghp_`) or fine-grained (`github_pat_`) token, validated with one
 * `GET /user` (see `docs/agents/modules/integrations/pat.md`).
 */
@Injectable()
export class PatStrategy implements IntegrationTypeStrategy {
  readonly type = 'pat' as const;
  readonly flows: IntegrationFlows = { credentialPaste: true, redirect: false };
  private readonly github: GithubClientService;
  private readonly logger: LoggerService;

  /**
   * @param {GithubClientService} github - The shared GitHub client.
   * @param {LoggerService} logger - Logs an unparseable expiry header, with safe fields only.
   */
  constructor(github: GithubClientService, logger: LoggerService) {
    this.github = github;
    this.logger = logger;
  }

  /**
   * Validates `{ token }` and wraps the trimmed token.
   * @param {unknown} raw - The request's `credential` object.
   * @returns {Secret} The wrapped `{ token }` payload.
   */
  parseCredential(raw: unknown): Secret {
    return parsePatCredential(raw);
  }

  /**
   * Re-validates a decrypted payload against `{ token }`.
   * @param {Secret} payload - The decrypted payload.
   * @returns {Secret | null} The payload, or `null` when it doesn't match.
   */
  parseSecretPayload(payload: Secret): Secret | null {
    return parsePatPayload(payload);
  }

  /**
   * Validates the token with `GET /user`; a classic token must have `repo`.
   * @param {Secret} secret - The `{ token }` payload.
   * @returns {Promise<ValidatedCredential>} The payload, login, expiry and metadata.
   */
  async validate(secret: Secret): Promise<ValidatedCredential> {
    const answer = await this.callGithub(secret);

    if (answer.kind !== 'ok') {
      throw validationErrorFor(answer);
    }

    const identity = this.identityFrom(secret, answer.login, answer.response);

    if (!hasRequiredPermissions(identity.metadata)) {
      throw new InsufficientPermissionsError('The classic token lacks the repo scope');
    }

    return { secret, ...identity };
  }

  /**
   * Tests a stored token with `GET /user`.
   * @param {Secret} secret - The decrypted `{ token }` payload.
   * @param {IntegrationView} current - The stored integration (its `expiresAt` tells expired from revoked).
   * @returns {Promise<TestOutcome>} The outcome.
   */
  async test(secret: Secret, current: IntegrationView): Promise<TestOutcome> {
    const answer = await this.callGithub(secret);

    switch (answer.kind) {
      case 'ok':
        return this.activeOutcome(secret, answer.login, answer.response);
      case 'unauthorized':
        return isPast(current.expiresAt) ? { kind: 'expired' } : { kind: 'invalid', reason: PAT_REASON_BAD_CREDENTIALS };
      case 'rate_limited':
        return { kind: 'transient', error: 'rate_limited', retryAfterSeconds: answer.retryAfterSeconds };
      default:
        return { kind: 'transient', error: 'unavailable' };
    }
  }

  /**
   * Validates the strict `{ tokenKind, scopes, permissionsVerified }` shape.
   * @param {unknown} metadata - The candidate metadata.
   * @returns {TypeMetadata} A normalised copy.
   */
  describeMetadata(metadata: unknown): TypeMetadata {
    return describePatMetadata(metadata);
  }

  /**
   * Builds the hint: the prefix, `…` and the last 4 characters.
   * @param {Secret} secret - The `{ token }` payload.
   * @returns {string} The hint.
   */
  mask(secret: Secret): string {
    return maskPatToken(tokenOf(secret));
  }

  /**
   * No-op: GitHub has no API for a third party to revoke a PAT.
   * @param {Secret | null} _secret - Unused.
   * @param {IntegrationView} _current - Unused.
   * @returns {Promise<void>} Resolves immediately.
   */
  async onDelete(_secret: Secret | null, _current: IntegrationView): Promise<void> {
    return undefined;
  }

  /**
   * Calls `GET /user` with the token, unwrapped only inside a fresh `Secret`.
   * @param {Secret} secret - The `{ token }` payload.
   * @returns {Promise<GithubUserAnswer>} The classified answer.
   */
  private callGithub(secret: Secret): Promise<GithubUserAnswer> {
    return fetchGithubUser(this.github, new Secret(tokenOf(secret)));
  }

  /**
   * Maps a 200 to `active`, or to `invalid` + `insufficient_permissions` for a classic token without `repo`.
   * @param {Secret} secret - The `{ token }` payload.
   * @param {string} login - The GitHub login.
   * @param {GithubUserResponse} response - The normalised answer.
   * @returns {TestOutcome} The outcome.
   */
  private activeOutcome(secret: Secret, login: string, response: GithubUserResponse): TestOutcome {
    const identity = this.identityFrom(secret, login, response);

    if (!hasRequiredPermissions(identity.metadata)) {
      return { kind: 'invalid', reason: STATUS_REASON_INSUFFICIENT_PERMISSIONS };
    }

    return { kind: 'active', ...identity };
  }

  /**
   * Builds the login, expiry and metadata from a 200.
   * @param {Secret} secret - The `{ token }` payload.
   * @param {string} login - The GitHub login.
   * @param {GithubUserResponse} response - The normalised answer.
   * @returns {PatIdentity} The identity.
   */
  private identityFrom(secret: Secret, login: string, response: GithubUserResponse): PatIdentity {
    const tokenKind = tokenKindOf(tokenOf(secret)) as PatTokenKind;

    return {
      githubLogin: login,
      expiresAt: this.expiryFrom(response.tokenExpiration, login),
      metadata: buildPatMetadata(tokenKind, response.oauthScopes),
    };
  }

  /**
   * Parses the expiry header; an unparseable one counts as absent and is logged with safe fields.
   * @param {string | null} header - The raw expiry header.
   * @param {string} githubLogin - The login, logged for context.
   * @returns {Date | null} The expiry, or `null`.
   */
  private expiryFrom(header: string | null, githubLogin: string): Date | null {
    const expiresAt = parseExpiration(header);

    if (expiresAt === undefined) {
      this.logger.warn('unparseable GitHub token expiration header', { type: this.type, githubLogin });
      return null;
    }

    return expiresAt;
  }
}

/**
 * Unwraps the token of a `{ token }` payload.
 * @param {Secret} secret - The payload.
 * @returns {string} The token.
 */
function tokenOf(secret: Secret): string {
  return (secret.reveal() as PatPayload).token;
}

/**
 * Whether the metadata satisfies the required permissions (fine-grained can't be checked).
 * @param {PatMetadata} metadata - The token's metadata.
 * @returns {boolean} `false` only for a classic token without `repo`.
 */
function hasRequiredPermissions(metadata: PatMetadata): boolean {
  return metadata.tokenKind !== 'classic' || (metadata.scopes ?? []).includes(REQUIRED_CLASSIC_SCOPE);
}

/**
 * Maps a non-`ok` answer to the create/replace error.
 * @param {GithubUserAnswer} answer - The classified answer.
 * @returns {Error} The domain error to throw.
 */
function validationErrorFor(answer: GithubUserAnswer): Error {
  switch (answer.kind) {
    case 'unauthorized':
      return new CredentialInvalidError();
    case 'rate_limited':
      return new GithubRateLimitedError(answer.retryAfterSeconds);
    default:
      return new GithubUnavailableError();
  }
}

/**
 * Whether a known date is in the past.
 * @param {Date | null} date - The date.
 * @returns {boolean} `true` when known and before now.
 */
function isPast(date: Date | null): boolean {
  return date !== null && date.getTime() < Date.now();
}
