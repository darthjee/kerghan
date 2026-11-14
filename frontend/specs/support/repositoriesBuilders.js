/**
 * Build a repository listing row (`api.md#listing`), defaulting to a public, not-added
 * `darthjee/kerghan` row.
 *
 * @param {object} [overrides] - Fields replacing the defaults.
 * @returns {object} The repository row.
 */
export function buildRepository(overrides = {}) {
  return {
    githubId: 123456,
    owner: 'darthjee',
    name: 'kerghan',
    fullName: 'darthjee/kerghan',
    private: false,
    status: 'not_added',
    addedAt: null,
    lastSeenAt: '2026-11-07T12:00:00Z',
    sources: [buildSource()],
    accessIntegration: null,
    ...overrides,
  };
}

/**
 * Build a sync-state source entry (`api.md#sync-state`), defaulting to an `ok` integration
 * source labelled `work-pat`.
 *
 * @param {object} [overrides] - Fields replacing the defaults.
 * @returns {object} The source entry.
 */
export function buildSource(overrides = {}) {
  return {
    kind: 'integration',
    integration: { uuid: 'uuid-1', label: 'work-pat' },
    status: 'ok',
    syncedAt: '2026-11-07T11:00:00Z',
    resetAt: null,
    ...overrides,
  };
}

/**
 * Build a sync-state object, defaulting to an idle one already synced, with Refresh available.
 *
 * @param {object} [overrides] - Fields replacing the defaults.
 * @returns {object} The sync-state object.
 */
export function buildSyncState(overrides = {}) {
  return {
    state: 'idle',
    startedAt: null,
    lastSyncedAt: '2026-11-07T11:00:00Z',
    refreshAvailableAt: null,
    sources: [buildSource()],
    ...overrides,
  };
}

/**
 * Build a listing response (`api.md#listing`).
 *
 * @param {{repositories?: Array<object>, pagination?: object, sync?: object}} [overrides] -
 *   Parts replacing the defaults.
 * @returns {{repositories: Array<object>, pagination: object, sync: object}} The listing.
 */
export function buildListing({ repositories, pagination, sync } = {}) {
  const rows = repositories ?? [buildRepository()];

  return {
    repositories: rows,
    pagination: pagination ?? { page: 1, perPage: 50, total: rows.length, totalPages: 1 },
    sync: sync ?? buildSyncState(),
  };
}
