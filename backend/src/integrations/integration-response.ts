import type { Integration } from './entities/integration.entity.js';
import type { IntegrationStatus, IntegrationTestResult } from './integration-enums.js';
import type { IntegrationView } from './types/integration-type-strategy.js';

/**
 * The public shape of an integration (see
 * `docs/agents/specs/integrations/api.md#integration-response`). Built from
 * an explicit allowlist: never the internal id, the owner, or any `secret_*`.
 */
export interface IntegrationResponse {
  id: string;
  provider: string;
  type: string;
  label: string;
  status: IntegrationStatus;
  statusReason: string | null;
  secretHint: string | null;
  githubLogin: string;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  lastTestedAt: string | null;
  nextTestAt: string | null;
  lastTestResult: IntegrationTestResult | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * The status reported to the owner:
 * - `undecryptable` when the row's key id doesn't match the configured key;
 * - `expired` when the stored status is `active` and `expiresAt` is past;
 * - otherwise the stored status.
 * @param {Integration} row - The stored row.
 * @param {boolean} keyIsCurrent - Whether the row's key id matches the configured key.
 * @param {Date} now - The current time.
 * @returns {IntegrationStatus} The reported status.
 */
export function reportedStatus(row: Integration, keyIsCurrent: boolean, now: Date): IntegrationStatus {
  if (!keyIsCurrent) {
    return 'undecryptable';
  }

  if (row.status === 'active' && row.expiresAt !== null && row.expiresAt < now) {
    return 'expired';
  }

  return row.status;
}

/**
 * Serialises a row for the owner, without decrypting anything.
 * @param {Integration} row - The stored row.
 * @param {boolean} keyIsCurrent - Whether the row's key id matches the configured key.
 * @param {Date | null} nextTestAt - When the test-connection cooldown ends (`null` if never tested).
 * @param {Date} [now] - The current time.
 * @returns {IntegrationResponse} The response body.
 */
export function toIntegrationResponse(
  row: Integration,
  keyIsCurrent: boolean,
  nextTestAt: Date | null,
  now: Date = new Date(),
): IntegrationResponse {
  const status = reportedStatus(row, keyIsCurrent, now);

  return {
    id: row.uuid,
    provider: row.provider,
    type: row.type,
    label: row.label,
    status,
    statusReason: status === 'invalid' ? row.statusReason : null,
    secretHint: status === 'undecryptable' ? null : row.secretHint,
    githubLogin: row.githubLogin,
    metadata: row.metadata,
    expiresAt: isoOrNull(row.expiresAt),
    lastTestedAt: isoOrNull(row.lastTestedAt),
    nextTestAt: isoOrNull(nextTestAt),
    lastTestResult: row.lastTestResult,
    createdAt: isoOrNull(row.createdAt),
    updatedAt: isoOrNull(row.updatedAt),
  };
}

/**
 * Builds the safe, non-secret view a strategy may read.
 * @param {Integration} row - The stored row.
 * @returns {IntegrationView} The view.
 */
export function toIntegrationView(row: Integration): IntegrationView {
  return {
    uuid: row.uuid,
    type: row.type,
    status: row.status,
    statusReason: row.statusReason,
    githubLogin: row.githubLogin,
    expiresAt: row.expiresAt,
    metadata: row.metadata,
  };
}

/**
 * Formats a date as ISO-8601.
 * @param {Date | null | undefined} date - The date.
 * @returns {string | null} The ISO string, or `null`.
 */
function isoOrNull(date: Date | null | undefined): string | null {
  return date ? new Date(date).toISOString() : null;
}
