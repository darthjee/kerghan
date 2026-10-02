/**
 * The string enumerations of the `integrations` table. The database stores
 * plain strings; these constants are what the code validates against (see
 * `docs/agents/specs/integrations/model.md#integrations-columns`).
 */

/** Supported providers. */
export const INTEGRATION_PROVIDERS = ['github'] as const;
/** A provider value. */
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

/** Every integration type the API accepts (registered or not on this server). */
export const INTEGRATION_TYPES = ['pat', 'oauth_app', 'github_app'] as const;
/** A type value. */
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

/** Stored statuses. */
export const INTEGRATION_STATUSES = ['active', 'invalid', 'expired', 'undecryptable'] as const;
/** A status value. */
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

/** Outcomes recorded in `last_test_result`. */
export const INTEGRATION_TEST_RESULTS = ['success', 'rejected', 'transient_error', 'undecryptable'] as const;
/** A test-result value. */
export type IntegrationTestResult = (typeof INTEGRATION_TEST_RESULTS)[number];

/** The generic `invalid` reason shared by every type. */
export const STATUS_REASON_INSUFFICIENT_PERMISSIONS = 'insufficient_permissions';
