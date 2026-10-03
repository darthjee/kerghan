import { Inject, Injectable } from '@nestjs/common';
import { fetchGithubUser, GithubUserAnswer } from '../../github-answer.js';
import { GithubClientService } from '../../github-client.service.js';
import { STATUS_REASON_INSUFFICIENT_PERMISSIONS } from '../../integration-enums.js';
import {
  CredentialInvalidError,
  GithubRateLimitedError,
  GithubUnavailableError,
  InsufficientPermissionsError,
} from '../../integration-errors.js';
import { flowUnsupported } from '../../integration-http-errors.js';
import { Secret } from '../../secret.js';
import {
  IntegrationFlows,
  IntegrationTypeStrategy,
  IntegrationView,
  TestOutcome,
  TypeMetadata,
  ValidatedCredential,
} from '../integration-type-strategy.js';
import { OauthAppCodeExchangeService } from './oauth-app-code-exchange.service.js';
import { EnabledOauthAppConfig, OAUTH_APP_CONFIG, OauthAppConfig } from './oauth-app-config.js';
import {
  maskOauthAppToken,
  OauthAppCodePayload,
  oauthAppTokenOf,
  parseOauthAppPayload,
} from './oauth-app-credential.js';
import { buildOauthAppMetadata, describeOauthAppMetadata, OauthAppMetadata } from './oauth-app-metadata.js';
import { OauthAppRevocationService, RevocationLogContext } from './oauth-app-revocation.service.js';

/** `invalid` reason for a 401: the authorization was revoked (or replaced, or unused for a year). */
export const OAUTH_APP_REASON_REVOKED = 'revoked';

// The scope required to read private repositories.
const REQUIRED_SCOPE = 'repo';

/**
 * The GitHub OAuth App (`oauth_app`) type: the user authorizes Kerghan's
 * OAuth App through a redirect flow and the resulting user access token is
 * stored (see `docs/agents/modules/integrations/oauth-app.md`). Its
 * `validate` exchanges the callback's code (with the PKCE verifier) and
 * checks the token with `GET /user`; any failure after a token was obtained
 * revokes it best-effort.
 */
@Injectable()
export class OauthAppStrategy implements IntegrationTypeStrategy {
  readonly type = 'oauth_app' as const;
  readonly flows: IntegrationFlows = { credentialPaste: false, redirect: true };
  private readonly github: GithubClientService;
  private readonly codeExchange: OauthAppCodeExchangeService;
  private readonly revocation: OauthAppRevocationService;
  private readonly config: OauthAppConfig;

  /**
   * @param {GithubClientService} github - The shared GitHub client (for `GET /user`).
   * @param {OauthAppCodeExchangeService} codeExchange - Exchanges a callback code for a token.
   * @param {OauthAppRevocationService} revocation - Revokes single tokens, best-effort.
   * @param {OauthAppConfig} config - The OAuth App server config, read once at boot.
   */
  constructor(
    github: GithubClientService,
    codeExchange: OauthAppCodeExchangeService,
    revocation: OauthAppRevocationService,
    @Inject(OAUTH_APP_CONFIG) config: OauthAppConfig,
  ) {
    this.github = github;
    this.codeExchange = codeExchange;
    this.revocation = revocation;
    this.config = config;
  }

  /**
   * Whether the OAuth App is configured on this server.
   * @returns {boolean} `true` when both client id and secret are set.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * The enabled config, or `null` when the type is disabled.
   * @returns {EnabledOauthAppConfig | null} The config.
   */
  enabledConfig(): EnabledOauthAppConfig | null {
    return this.config.enabled ? this.config : null;
  }

  /**
   * Never reached: the generic pipeline rejects types without credential-paste first.
   * @param {unknown} _raw - Unused.
   * @returns {Secret} Never returns.
   */
  parseCredential(_raw: unknown): Secret {
    throw flowUnsupported();
  }

  /**
   * Re-validates a decrypted payload against `{ token }`.
   * @param {Secret} payload - The decrypted payload.
   * @returns {Secret | null} The payload, or `null` when it doesn't match.
   */
  parseSecretPayload(payload: Secret): Secret | null {
    return parseOauthAppPayload(payload);
  }

  /**
   * Exchanges the code for a token and checks it with `GET /user` (it must have `repo`).
   * @param {Secret} secret - The `{ code, codeVerifier }` payload built by the flow service.
   * @returns {Promise<ValidatedCredential>} The `{ token }` payload, login, `null` expiry and metadata.
   */
  async validate(secret: Secret): Promise<ValidatedCredential> {
    const config = this.enabledConfig();

    if (config === null) {
      throw new GithubUnavailableError();
    }

    const token = await this.codeExchange.exchange(config, secret.reveal() as OauthAppCodePayload);

    try {
      return await this.identify(token, config.clientId);
    } catch (error) {
      await this.revoke(token, config.clientId);
      throw error;
    }
  }

  /**
   * Tests a stored token with `GET /user`. Needs no app config, so it works while disabled.
   * @param {Secret} secret - The decrypted `{ token }` payload.
   * @param {IntegrationView} current - The stored integration (its `clientId` is kept).
   * @returns {Promise<TestOutcome>} The outcome; never `expired`.
   */
  async test(secret: Secret, current: IntegrationView): Promise<TestOutcome> {
    const answer = await this.callGithub(secret);

    switch (answer.kind) {
      case 'ok':
        return this.activeOutcome(answer, this.clientIdOf(current));
      case 'unauthorized':
        return { kind: 'invalid', reason: OAUTH_APP_REASON_REVOKED };
      case 'rate_limited':
        return { kind: 'transient', error: 'rate_limited', retryAfterSeconds: answer.retryAfterSeconds };
      default:
        return { kind: 'transient', error: 'unavailable' };
    }
  }

  /**
   * Validates the strict `{ scopes, clientId }` shape.
   * @param {unknown} metadata - The candidate metadata.
   * @returns {TypeMetadata} A normalised copy.
   */
  describeMetadata(metadata: unknown): TypeMetadata {
    return describeOauthAppMetadata(metadata);
  }

  /**
   * Builds the hint: `gho_`, `…` and the last 4 characters.
   * @param {Secret} secret - The `{ token }` payload.
   * @returns {string} The hint.
   */
  mask(secret: Secret): string {
    return maskOauthAppToken(oauthAppTokenOf(secret));
  }

  /**
   * Revokes the integration's token best-effort; an undecryptable row makes no call.
   * @param {Secret | null} secret - The decrypted `{ token }` payload, or `null`.
   * @param {IntegrationView} current - The stored integration.
   * @returns {Promise<void>} Resolves once done; never throws.
   */
  async onDelete(secret: Secret | null, current: IntegrationView): Promise<void> {
    if (secret === null) {
      return;
    }

    await this.revoke(new Secret(oauthAppTokenOf(secret)), this.clientIdOf(current), { integrationUuid: current.uuid });
  }

  /**
   * Best-effort revocation of one token; see `OauthAppRevocationService#revoke`.
   * @param {Secret<string>} token - The token.
   * @param {string | null} clientIdOfToken - The client id the token was issued to, when known.
   * @param {RevocationLogContext} [context] - Safe fields for the logs.
   * @returns {Promise<void>} Resolves once done; never throws.
   */
  revoke(token: Secret<string>, clientIdOfToken: string | null, context: RevocationLogContext = {}): Promise<void> {
    return this.revocation.revoke(token, clientIdOfToken, context);
  }

  /**
   * Checks a new token with `GET /user`: it must be accepted and have `repo`.
   * @param {Secret<string>} token - The new token.
   * @param {string} clientId - The app's client id.
   * @returns {Promise<ValidatedCredential>} The validated credential.
   */
  private async identify(token: Secret<string>, clientId: string): Promise<ValidatedCredential> {
    const answer = await fetchGithubUser(this.github, token);

    if (answer.kind !== 'ok') {
      throw validationErrorFor(answer);
    }

    const metadata = buildOauthAppMetadata(answer.response.oauthScopes, clientId);

    if (!hasRequiredScope(metadata)) {
      throw new InsufficientPermissionsError('The authorization lacks the repo scope');
    }

    return { secret: new Secret({ token: token.reveal() }), githubLogin: answer.login, expiresAt: null, metadata };
  }

  /**
   * Calls `GET /user` with the stored token, unwrapped only inside a fresh `Secret`.
   * @param {Secret} secret - The `{ token }` payload.
   * @returns {Promise<GithubUserAnswer>} The classified answer.
   */
  private callGithub(secret: Secret): Promise<GithubUserAnswer> {
    return fetchGithubUser(this.github, new Secret(oauthAppTokenOf(secret)));
  }

  /**
   * Maps a 200 to `active`, or to `invalid` + `insufficient_permissions` without `repo`.
   * @param {Extract<GithubUserAnswer, { kind: 'ok' }>} answer - The `ok` answer.
   * @param {string | null} clientId - The client id the token was issued to.
   * @returns {TestOutcome} The outcome.
   */
  private activeOutcome(answer: Extract<GithubUserAnswer, { kind: 'ok' }>, clientId: string | null): TestOutcome {
    const metadata = buildOauthAppMetadata(answer.response.oauthScopes, clientId ?? this.enabledConfig()?.clientId ?? '');

    if (!hasRequiredScope(metadata)) {
      return { kind: 'invalid', reason: STATUS_REASON_INSUFFICIENT_PERMISSIONS };
    }

    return { kind: 'active', githubLogin: answer.login, expiresAt: null, metadata };
  }

  /**
   * The client id stored in an integration's metadata.
   * @param {IntegrationView} current - The stored integration.
   * @returns {string | null} The client id, or `null` when absent.
   */
  private clientIdOf(current: IntegrationView): string | null {
    const { clientId } = current.metadata;

    return typeof clientId === 'string' ? clientId : null;
  }
}

/**
 * Whether the metadata holds the `repo` scope.
 * @param {OauthAppMetadata} metadata - The token's metadata.
 * @returns {boolean} Whether `repo` was granted.
 */
function hasRequiredScope(metadata: OauthAppMetadata): boolean {
  return metadata.scopes.includes(REQUIRED_SCOPE);
}

/**
 * Maps a non-`ok` `GET /user` answer to the callback error.
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
