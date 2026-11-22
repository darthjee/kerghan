/** A well-formed project uuid, for specs. */
export const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

/** A well-formed issue uuid, for specs. */
export const ISSUE_ID = '22222222-2222-4222-8222-222222222222';

/**
 * Build a project's repository summary (`docs/agents/specs/issues/api/projects.md`), defaulting
 * to the added `darthjee/kerghan` repository.
 *
 * @param {object} [overrides] - Fields replacing the defaults.
 * @returns {object} The repository summary.
 */
export function buildProjectRepository(overrides = {}) {
  return {
    githubId: 123456,
    owner: 'darthjee',
    name: 'kerghan',
    fullName: 'darthjee/kerghan',
    private: false,
    status: 'added',
    ...overrides,
  };
}

/**
 * Build a project object, defaulting to a project named `Kerghan` with the default repository.
 *
 * @param {object} [overrides] - Fields replacing the defaults (use `repository: null` for a
 *   project without a repository).
 * @returns {object} The project.
 */
export function buildProject(overrides = {}) {
  return {
    id: PROJECT_ID,
    name: 'Kerghan',
    description: 'Issue monitoring',
    repository: buildProjectRepository(),
    openIssueCount: 0,
    createdAt: '2026-11-07T10:00:00.000Z',
    updatedAt: '2026-11-07T11:00:00.000Z',
    ...overrides,
  };
}

/**
 * Build an issue's GitHub link (`docs/agents/specs/issues/api/github-link.md`), defaulting to a
 * healthy link to issue #12.
 *
 * @param {object} [overrides] - Fields replacing the defaults.
 * @returns {object} The link.
 */
export function buildLink(overrides = {}) {
  return {
    number: 12,
    url: 'https://github.com/darthjee/kerghan/issues/12',
    state: 'linked',
    states: ['linked'],
    reason: null,
    rateLimitedUntil: null,
    lastSyncedAt: '2026-11-07T11:00:00.000Z',
    stale: false,
    ...overrides,
  };
}

/**
 * Build an issue object, defaulting to an open, unlinked issue.
 *
 * @param {object} [overrides] - Fields replacing the defaults (use `link: buildLink()` for a
 *   linked issue).
 * @returns {object} The issue.
 */
export function buildIssue(overrides = {}) {
  return {
    id: ISSUE_ID,
    title: 'Fix the login',
    body: 'Steps to reproduce',
    state: 'open',
    createdAt: '2026-11-07T10:00:00.000Z',
    updatedAt: '2026-11-07T11:00:00.000Z',
    link: null,
    ...overrides,
  };
}

/**
 * Build a pagination object.
 *
 * @param {object} [overrides] - Fields replacing the defaults (one page of one row).
 * @returns {{page: number, perPage: number, total: number, totalPages: number}} The pagination.
 */
export function buildPagination(overrides = {}) {
  return {
    page: 1, perPage: 50, total: 1, totalPages: 1, ...overrides,
  };
}

/**
 * Build a project listing response.
 *
 * @param {{projects?: Array<object>, pagination?: object}} [parts] - Parts replacing the
 *   defaults (one project, one page).
 * @returns {{projects: Array<object>, pagination: object}} The listing.
 */
export function buildProjectListing({ projects, pagination } = {}) {
  const rows = projects ?? [buildProject()];

  return { projects: rows, pagination: pagination ?? buildPagination({ total: rows.length }) };
}

/**
 * Build an issue listing response.
 *
 * @param {{issues?: Array<object>, pagination?: object}} [parts] - Parts replacing the defaults
 *   (one issue, one page).
 * @returns {{issues: Array<object>, pagination: object}} The listing.
 */
export function buildIssueListing({ issues, pagination } = {}) {
  const rows = issues ?? [buildIssue()];

  return { issues: rows, pagination: pagination ?? buildPagination({ total: rows.length }) };
}

/**
 * Build the standard backend error body, as the fake transport's `json`.
 *
 * @param {number} statusCode - The HTTP status.
 * @param {string} code - The machine-readable error code.
 * @param {object} [extra] - Further `error` fields (`message`, `details`, `meta`,
 *   `retryAfterSeconds`).
 * @returns {object} The error body.
 */
export function buildErrorBody(statusCode, code, extra = {}) {
  return {
    error: { code, message: 'nope', ...extra },
    statusCode,
    timestamp: '2026-11-07T12:00:00.000Z',
  };
}

/**
 * Build a failed fake-transport response descriptor.
 *
 * @param {number} status - The HTTP status.
 * @param {string} code - The machine-readable error code.
 * @param {object} [extra] - Further `error` fields.
 * @returns {{ok: boolean, status: number, json: object}} The response descriptor.
 */
export function buildFailure(status, code, extra = {}) {
  return { ok: false, status, json: buildErrorBody(status, code, extra) };
}
