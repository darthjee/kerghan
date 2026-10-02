/**
 * Category and specific error codes carried in `error.code` of every error
 * response body (see `http-exception.filter.ts`). Category codes are derived
 * from the HTTP status when a throw site gives no specific code; specific
 * codes are attached at the throw site (e.g.
 * `new ConflictException({ code: ErrorCodes.USERNAME_TAKEN, message })`).
 */
export const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  LOCKED: 'LOCKED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_GATEWAY: 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INTEGRATION_FLOW_UNSUPPORTED: 'INTEGRATION_FLOW_UNSUPPORTED',
  INTEGRATION_REDIRECT_STATE_INVALID: 'INTEGRATION_REDIRECT_STATE_INVALID',
  INTEGRATION_LABEL_TAKEN: 'INTEGRATION_LABEL_TAKEN',
  INTEGRATIONS_LIMIT_REACHED: 'INTEGRATIONS_LIMIT_REACHED',
  INTEGRATION_CREDENTIAL_INVALID: 'INTEGRATION_CREDENTIAL_INVALID',
  INTEGRATION_INSUFFICIENT_PERMISSIONS: 'INTEGRATION_INSUFFICIENT_PERMISSIONS',
  INTEGRATION_INSTALLATION_NOT_ACCESSIBLE: 'INTEGRATION_INSTALLATION_NOT_ACCESSIBLE',
  INTEGRATION_INSTALLATION_SUSPENDED: 'INTEGRATION_INSTALLATION_SUSPENDED',
  INTEGRATION_CREDENTIAL_LOCKED: 'INTEGRATION_CREDENTIAL_LOCKED',
  INTEGRATION_TEST_COOLDOWN: 'INTEGRATION_TEST_COOLDOWN',
  GITHUB_UNAVAILABLE: 'GITHUB_UNAVAILABLE',
  GITHUB_RATE_LIMITED: 'GITHUB_RATE_LIMITED',
} as const;

// Message used for every unexpected (non-HTTP) error — the real message and
// stack are logged, never sent to the client.
export const INTERNAL_ERROR_MESSAGE = 'Internal server error';

const CATEGORY_CODES = new Map<number, string>([
  [400, ErrorCodes.BAD_REQUEST],
  [401, ErrorCodes.UNAUTHORIZED],
  [403, ErrorCodes.FORBIDDEN],
  [404, ErrorCodes.NOT_FOUND],
  [409, ErrorCodes.CONFLICT],
  [422, ErrorCodes.UNPROCESSABLE_ENTITY],
  [423, ErrorCodes.LOCKED],
  [429, ErrorCodes.TOO_MANY_REQUESTS],
  [500, ErrorCodes.INTERNAL_ERROR],
  [502, ErrorCodes.BAD_GATEWAY],
  [503, ErrorCodes.SERVICE_UNAVAILABLE],
]);

/**
 * Maps an HTTP status to its category error code.
 * @param {number} status - The HTTP status code.
 * @returns {string} The category code, or `HTTP_<status>` for unmapped statuses.
 */
export function categoryCodeFor(status: number): string {
  return CATEGORY_CODES.get(status) ?? `HTTP_${status}`;
}
