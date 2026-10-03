import { Inject, Injectable } from '@nestjs/common';
import { EnabledGithubAppConfig, GITHUB_APP_CONFIG, GithubAppConfig } from './github-app-config.js';
import {
  githubAppPayload,
  installationIdOf,
  maskInstallationId,
  parseGithubAppPayload,
} from './github-app-credential.js';
import { GithubAppInstallationService } from './github-app-installation.service.js';
import { buildGithubAppMetadata, describeGithubAppMetadata, isGithubLogin } from './github-app-metadata.js';
import { GithubAppUserVerificationService, VerifiedGithubUser } from './github-app-user-verification.service.js';
import { flowUnsupported } from '../../integration-http-errors.js';
import type { Secret } from '../../secret.js';
import {
  IntegrationFlows,
  IntegrationTypeStrategy,
  IntegrationView,
  TestOutcome,
  TypeMetadata,
  ValidatedCredential,
} from '../integration-type-strategy.js';

/**
 * The GitHub App installation (`github_app`) type: the user installs
 * Kerghan's GitHub App (or connects an installation they can access) and
 * Kerghan stores only **which installation** it is; installation tokens are
 * minted on demand from the app's private key and never stored (see
 * `docs/agents/modules/integrations/github-app.md`).
 *
 * It has no `validate(secret)` on a pasted value: the type-owned routes call
 * `verifyUser` (ownership, with a user token) and `validateInstallation`
 * (app-JWT checks), then the generic storage code.
 */
@Injectable()
export class GithubAppStrategy implements IntegrationTypeStrategy {
  readonly type = 'github_app' as const;
  readonly flows: IntegrationFlows = { credentialPaste: false, redirect: true };
  private readonly userVerification: GithubAppUserVerificationService;
  private readonly installations: GithubAppInstallationService;
  private readonly config: GithubAppConfig;

  /**
   * @param {GithubAppUserVerificationService} userVerification - Proves which installations the user can access.
   * @param {GithubAppInstallationService} installations - Runs the app-JWT installation checks.
   * @param {GithubAppConfig} config - The GitHub App server config, read once at boot.
   */
  constructor(
    userVerification: GithubAppUserVerificationService,
    installations: GithubAppInstallationService,
    @Inject(GITHUB_APP_CONFIG) config: GithubAppConfig,
  ) {
    this.userVerification = userVerification;
    this.installations = installations;
    this.config = config;
  }

  /**
   * Whether the GitHub App is configured on this server.
   * @returns {boolean} `true` when all five variables are set.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * The enabled config, or `null` when the type is disabled.
   * @returns {EnabledGithubAppConfig | null} The config.
   */
  enabledConfig(): EnabledGithubAppConfig | null {
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
   * Re-validates a decrypted payload against `{ installationId }`.
   * @param {Secret} payload - The decrypted payload.
   * @returns {Secret | null} The payload, or `null` when it doesn't match.
   */
  parseSecretPayload(payload: Secret): Secret | null {
    return parseGithubAppPayload(payload);
  }

  /**
   * Not used: the type-owned routes call `verifyUser` and `validateInstallation` instead.
   * @param {Secret} _secret - Unused.
   * @returns {Promise<ValidatedCredential>} Never resolves.
   */
  async validate(_secret: Secret): Promise<ValidatedCredential> {
    throw flowUnsupported();
  }

  /**
   * Ownership check (spec *Validate / create* steps 1–2): exchanges the code
   * and lists the user's installations of this app; the user token is
   * revoked on every path and never leaves the verification service.
   * @param {EnabledGithubAppConfig} config - The app config.
   * @param {Secret<string>} code - The callback code.
   * @param {number} userId - The Kerghan user, for the logs.
   * @returns {Promise<VerifiedGithubUser>} The verifying login and the verified installations.
   */
  verifyUser(config: EnabledGithubAppConfig, code: Secret<string>, userId: number): Promise<VerifiedGithubUser> {
    return this.userVerification.verify(config, code, userId);
  }

  /**
   * Installation checks (spec *Validate / create* steps 3–4) and what gets stored.
   * @param {EnabledGithubAppConfig} config - The app config.
   * @param {number} installationId - A verified installation id.
   * @param {string} verifiedBy - The GitHub login that proved access.
   * @returns {Promise<ValidatedCredential>} The `{ installationId }` payload, account login, `null` expiry and metadata.
   */
  async validateInstallation(
    config: EnabledGithubAppConfig,
    installationId: number,
    verifiedBy: string,
  ): Promise<ValidatedCredential> {
    const installation = await this.installations.verify(config, installationId);

    return {
      secret: githubAppPayload(installation.installationId),
      githubLogin: installation.accountLogin,
      expiresAt: null,
      metadata: buildGithubAppMetadata(installation, verifiedBy),
    };
  }

  /**
   * Tests a stored installation with the app JWT only. While disabled, no
   * JWT can be signed: transient `unavailable`, without any GitHub call.
   * @param {Secret} secret - The decrypted `{ installationId }` payload.
   * @param {IntegrationView} current - The stored integration (its `verifiedBy` is kept).
   * @returns {Promise<TestOutcome>} The outcome; never `expired`.
   */
  async test(secret: Secret, current: IntegrationView): Promise<TestOutcome> {
    const config = this.enabledConfig();

    if (config === null) {
      return { kind: 'transient', error: 'unavailable' };
    }

    const probe = await this.installations.probe(config, installationIdOf(secret));

    if (probe.kind !== 'ok') {
      return probe;
    }

    const { verifiedBy } = current.metadata;

    return {
      kind: 'active',
      githubLogin: probe.installation.accountLogin,
      expiresAt: null,
      metadata: buildGithubAppMetadata(
        probe.installation,
        isGithubLogin(verifiedBy) ? verifiedBy : probe.installation.accountLogin,
      ),
    };
  }

  /**
   * Validates the strict seven-key metadata shape.
   * @param {unknown} metadata - The candidate metadata.
   * @returns {TypeMetadata} A copy.
   */
  describeMetadata(metadata: unknown): TypeMetadata {
    return describeGithubAppMetadata(metadata);
  }

  /**
   * Builds the hint: `installation …` and the last 4 digits.
   * @param {Secret} secret - The `{ installationId }` payload.
   * @returns {string} The hint.
   */
  mask(secret: Secret): string {
    return maskInstallationId(installationIdOf(secret));
  }

  /**
   * Does nothing on GitHub: no uninstall, no token to revoke. The
   * installation belongs to the GitHub account and may serve other rows.
   * @param {Secret | null} _secret - Unused.
   * @param {IntegrationView} _current - Unused.
   * @returns {Promise<void>} Resolves immediately.
   */
  async onDelete(_secret: Secret | null, _current: IntegrationView): Promise<void> {
    return undefined;
  }
}
