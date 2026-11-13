import type { SourceStatus } from '../entities/repository-source-status.entity.js';
import { deriveRowStatus, effectiveIntegrationId, isOkStatus, type RowStatusInput } from '../row-status.js';

const ADDED = new Date('2026-05-01T00:00:00Z');
const INTEGRATIONS = new Set([1, 2]);

function status(row: Partial<RowStatusInput>, keys: string[], statuses: Record<string, SourceStatus>): string {
  return deriveRowStatus(
    { addedAt: ADDED, private: false, integrationId: null, ...row },
    keys,
    new Map(Object.entries(statuses)),
    INTEGRATIONS,
  );
}

describe('deriveRowStatus', () => {
  it.each([
    ['added_at null ⇒ Not added', { addedAt: null }, ['integration:1'], { 'integration:1': 'ok' }, 'not_added'],
    ['not added with no source row ⇒ Not added', { addedAt: null }, [], {}, 'not_added'],
    ['added and returned by an ok source ⇒ Added', {}, ['integration:1'], { 'integration:1': 'ok' }, 'added'],
    ['added with no source row left ⇒ Unavailable', {}, [], {}, 'unavailable'],
    ['added, held only by a failed source ⇒ Unknown', {}, ['integration:1'], { 'integration:1': 'error' }, 'unknown'],
    ['added, held only by a pending source ⇒ Unknown', {}, ['integration:2'], {}, 'unknown'],
    ['one ok source row makes a pending-held repo Added', {}, ['integration:2', 'handle'], { handle: 'ok' }, 'added'],
    ['page_cap_reached counts as ok', {}, ['integration:1'], { 'integration:1': 'page_cap_reached' }, 'added'],
    ['held only by a not_found handle ⇒ Unknown', {}, ['handle'], { handle: 'not_found' }, 'unknown'],
    ['rate_limited is not ok', {}, ['handle'], { handle: 'rate_limited' }, 'unknown'],
    ['invalid_credentials is not ok', {}, ['integration:1'], { 'integration:1': 'invalid_credentials' }, 'unknown'],
    ['private with a dangling link ⇒ Unavailable, even if another source sees it',
      { private: true, integrationId: 9 }, ['integration:1'], { 'integration:1': 'ok' }, 'unavailable'],
    ['private with an empty link ⇒ Unavailable', { private: true }, ['integration:1'], { 'integration:1': 'ok' }, 'unavailable'],
    ['private with a live link ⇒ Added', { private: true, integrationId: 2 }, ['integration:1'], { 'integration:1': 'ok' }, 'added'],
    ['public with a dangling link stays Added', { integrationId: 9 }, ['handle'], { handle: 'ok' }, 'added'],
  ] as Array<[string, Partial<RowStatusInput>, string[], Record<string, SourceStatus>, string]>)('%s', (_name, row, keys, statuses, expected) => {
    expect(status(row, keys, statuses)).toBe(expected);
  });
});

describe('effectiveIntegrationId', () => {
  it('reads a dangling link as empty', () => {
    expect(effectiveIntegrationId(9, INTEGRATIONS)).toBeNull();
    expect(effectiveIntegrationId(null, INTEGRATIONS)).toBeNull();
    expect(effectiveIntegrationId(2, INTEGRATIONS)).toBe(2);
  });
});

describe('isOkStatus', () => {
  it('treats ok and page_cap_reached as ok, pending (undefined) and failures as not ok', () => {
    expect(isOkStatus('ok')).toBe(true);
    expect(isOkStatus('page_cap_reached')).toBe(true);
    expect(isOkStatus(undefined)).toBe(false);
    expect(isOkStatus('not_found')).toBe(false);
  });
});
