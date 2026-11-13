import { listingResponse, repositoryResponse, syncStateResponse } from '../repositories-response.js';
import type { ListedRepository, SyncStateResult } from '../types/repositories-api.types.js';

const ADDED_AT = new Date('2026-11-07T12:00:00Z');
const SEEN_AT = new Date('2026-11-07T12:30:00Z');

function row(overrides: Partial<ListedRepository> = {}): ListedRepository {
  return {
    githubId: 123_456,
    owner: 'darthjee',
    name: 'kerghan',
    fullName: 'darthjee/kerghan',
    private: false,
    status: 'added',
    addedAt: ADDED_AT,
    lastSeenAt: SEEN_AT,
    sources: [
      { kind: 'integration', integration: { uuid: 'u-1', label: 'work-pat' } },
      { kind: 'handle', handle: 'darthjee' },
    ],
    accessIntegration: { uuid: 'u-1', label: 'work-pat' },
    ...overrides,
  };
}

function syncing(): SyncStateResult {
  return {
    state: 'syncing',
    startedAt: ADDED_AT,
    lastSyncedAt: null,
    refreshAvailableAt: SEEN_AT,
    sources: [
      { kind: 'integration', integration: { uuid: 'u-1', label: 'work-pat' }, status: 'ok', syncedAt: ADDED_AT, resetAt: null },
      { kind: 'handle', handle: 'darthjee', status: 'rate_limited', syncedAt: ADDED_AT, resetAt: SEEN_AT },
    ],
  };
}

const FORBIDDEN_KEYS = ['id', 'userId', 'user_id', 'integrationId', 'integration_id', 'secretHint', 'githubLogin', 'statusReason'];

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value === null || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
}

describe('repositories-response', () => {
  it('shapes a row exactly, with ISO dates', () => {
    expect(repositoryResponse(row())).toEqual({
      githubId: 123_456,
      owner: 'darthjee',
      name: 'kerghan',
      fullName: 'darthjee/kerghan',
      private: false,
      status: 'added',
      addedAt: '2026-11-07T12:00:00.000Z',
      lastSeenAt: '2026-11-07T12:30:00.000Z',
      sources: [
        { kind: 'integration', integration: { uuid: 'u-1', label: 'work-pat' } },
        { kind: 'handle', handle: 'darthjee' },
      ],
      accessIntegration: { uuid: 'u-1', label: 'work-pat' },
    });
  });

  it('answers null addedAt and accessIntegration for a not-added row', () => {
    expect(repositoryResponse(row({ status: 'not_added', addedAt: null, accessIntegration: null })))
      .toMatchObject({ addedAt: null, accessIntegration: null });
  });

  it('copies fields explicitly, dropping any internal field', () => {
    const leaky = {
      ...row(),
      id: 7,
      userId: 3,
      integrationId: 11,
      sources: [{ kind: 'integration', integration: { uuid: 'u', label: 'l', id: 11, secretHint: 'x' } }],
      accessIntegration: { uuid: 'u', label: 'l', id: 11, githubLogin: 'g', statusReason: 's' },
    } as unknown as ListedRepository;

    const keys = keysOf(repositoryResponse(leaky));

    FORBIDDEN_KEYS.forEach((key) => expect(keys).not.toContain(key));
  });

  it('shapes the sync state exactly, with ISO dates', () => {
    expect(syncStateResponse(syncing())).toEqual({
      state: 'syncing',
      startedAt: '2026-11-07T12:00:00.000Z',
      lastSyncedAt: null,
      refreshAvailableAt: '2026-11-07T12:30:00.000Z',
      sources: [
        {
          kind: 'integration',
          integration: { uuid: 'u-1', label: 'work-pat' },
          status: 'ok',
          syncedAt: '2026-11-07T12:00:00.000Z',
          resetAt: null,
        },
        {
          kind: 'handle',
          handle: 'darthjee',
          status: 'rate_limited',
          syncedAt: '2026-11-07T12:00:00.000Z',
          resetAt: '2026-11-07T12:30:00.000Z',
        },
      ],
    });
  });

  it('drops internal fields from the sync-state sources', () => {
    const leaky = {
      ...syncing(),
      userId: 3,
      sources: [{ kind: 'handle', handle: 'x', status: 'pending', syncedAt: null, resetAt: null, userId: 3, viaIntegrationId: 11 }],
    } as unknown as SyncStateResult;

    expect(syncStateResponse(leaky)).toEqual({
      state: 'syncing',
      startedAt: '2026-11-07T12:00:00.000Z',
      lastSyncedAt: null,
      refreshAvailableAt: '2026-11-07T12:30:00.000Z',
      sources: [{ kind: 'handle', handle: 'x', status: 'pending', syncedAt: null, resetAt: null }],
    });
  });

  it('shapes the listing with pagination and sync keys', () => {
    const body = listingResponse({ repositories: [row()], page: 2, perPage: 1, total: 3, totalPages: 3 }, syncing());

    expect(Object.keys(body)).toEqual(['repositories', 'pagination', 'sync']);
    expect(body.pagination).toEqual({ page: 2, perPage: 1, total: 3, totalPages: 3 });
    expect(body.repositories).toEqual([repositoryResponse(row())]);
    expect(body.sync).toEqual(syncStateResponse(syncing()));
  });
});
