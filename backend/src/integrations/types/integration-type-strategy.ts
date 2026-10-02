import type { IntegrationStatus, IntegrationType } from '../integration-enums.js';
import type { Secret } from '../secret.js';

/**
 * DI token holding every registered strategy, in registry order (see
 * `IntegrationTypeRegistry`).
 */
export const INTEGRATION_TYPE_STRATEGIES = Symbol('INTEGRATION_TYPE_STRATEGIES');

/** How a type obtains its credential. */
export interface IntegrationFlows {
  credentialPaste: boolean;
  redirect: boolean;
}

/** Non-secret, type-defined metadata stored in the `metadata` column. */
export type TypeMetadata = Record<string, unknown>;

/** What a successful validation produces; the generic code encrypts and stores it. */
export interface ValidatedCredential {
  /** The plaintext payload to encrypt (type-defined JSON shape). */
  secret: Secret;
  githubLogin: string;
  expiresAt: Date | null;
  metadata: TypeMetadata;
}

/** The outcome of a test connection. */
export type TestOutcome =
  | { kind: 'active'; githubLogin: string; expiresAt: Date | null; metadata: TypeMetadata }
  | { kind: 'invalid'; reason: string }
  | { kind: 'expired' }
  | { kind: 'transient'; error: 'unavailable' | 'rate_limited'; retryAfterSeconds?: number };

/** The safe, non-secret view of a stored integration a strategy may read. */
export interface IntegrationView {
  uuid: string;
  type: string;
  status: IntegrationStatus;
  statusReason: string | null;
  githubLogin: string;
  expiresAt: Date | null;
  metadata: TypeMetadata;
}

/**
 * The extension point every integration type implements (see
 * `docs/agents/specs/integrations/type-contract.md`). The generic code never
 * branches on `type`; it delegates to the strategy looked up in the registry.
 */
export interface IntegrationTypeStrategy {
  readonly type: IntegrationType;
  readonly flows: IntegrationFlows;

  /**
   * Whether this server can create the type (e.g. its server config is set).
   * Omitted means always enabled.
   */
  isEnabled?(): boolean;

  /**
   * Validates the `credential` request object and wraps it as early as
   * possible. Throws `400 VALIDATION_FAILED` with field-only messages.
   */
  parseCredential(raw: unknown): Secret;

  /**
   * Re-validates a decrypted payload against the type's secret shape;
   * `null` means the payload is unusable (handled as undecryptable).
   */
  parseSecretPayload(payload: Secret): Secret | null;

  /** Validates the credential against GitHub and builds what gets stored. */
  validate(secret: Secret): Promise<ValidatedCredential>;

  /** Maps GitHub's answer for a stored secret to a test outcome. */
  test(secret: Secret, current: IntegrationView): Promise<TestOutcome>;

  /** Validates and normalises the non-secret metadata the type stores. */
  describeMetadata(metadata: unknown): TypeMetadata;

  /** Produces the `secretHint`; called only at create/replace. */
  mask(secret: Secret): string;

  /** Best-effort cleanup on delete; must never throw past the caller's catch. */
  onDelete(secret: Secret | null, current: IntegrationView): Promise<void>;
}
