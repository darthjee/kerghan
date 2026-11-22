import { Issue } from '../entities/issue.entity.js';
import type { IssueLinkResponse } from '../issue-link-presenter.js';
import { issueDeleteResponse, issueListingResponse, issueListRow, issueResponse } from '../issue-response.js';

function recordRow(): Omit<Issue, 'body'> {
  const { body, ...record } = issueRow();

  expect(body).toBe('Details');
  return record;
}

function linkObject(): IssueLinkResponse {
  return {
    number: 12,
    url: 'https://github.com/darthjee/kerghan/issues/12',
    state: 'linked',
    states: ['linked'],
    reason: null,
    rateLimitedUntil: null,
    lastSyncedAt: '2026-11-07T12:00:00.000Z',
    stale: false,
  };
}

function issueRow(): Issue {
  return Object.assign(new Issue(), {
    id: 7,
    uuid: '3f0c1f8e-0000-4000-8000-000000000001',
    projectId: 3,
    title: 'Fix it',
    body: 'Details',
    state: 'open',
    createdAt: new Date('2026-11-07T12:00:00.000Z'),
    updatedAt: new Date('2026-11-07T12:00:05.123Z'),
  });
}

describe('issue-response', () => {
  it('builds the issue object with the uuid as id and no internal field', () => {
    const response = issueResponse(issueRow(), undefined);

    expect(response).toEqual({
      id: '3f0c1f8e-0000-4000-8000-000000000001',
      title: 'Fix it',
      body: 'Details',
      state: 'open',
      createdAt: '2026-11-07T12:00:00.000Z',
      updatedAt: '2026-11-07T12:00:05.123Z',
      link: null,
    });
    expect(Object.keys(response)).not.toContain('projectId');
    expect(Object.keys(response)).not.toContain('project_id');
  });

  it('keeps the milliseconds of updatedAt', () => {
    expect(issueResponse(issueRow(), undefined).updatedAt).toBe('2026-11-07T12:00:05.123Z');
  });

  it('leaves the body out of a listing row', () => {
    const row = issueListRow(recordRow(), undefined);

    expect(Object.keys(row)).toEqual(['id', 'title', 'state', 'createdAt', 'updatedAt', 'link']);
    expect(row.id).toBe('3f0c1f8e-0000-4000-8000-000000000001');
  });

  it('sets link to the presenter entry, or null when the map has none', () => {
    const row = issueRow();
    const link = linkObject();

    expect(issueResponse(row, link).link).toBe(link);
    expect(issueResponse(row, undefined).link).toBeNull();
  });

  it('builds the listing body reading each row link from the map', () => {
    const record = recordRow();
    const link = linkObject();
    const listing = issueListingResponse(
      [record],
      new Map([[7, link]]),
      { page: 2, perPage: 5, total: 6, totalPages: 2 },
    );

    expect(listing.pagination).toEqual({ page: 2, perPage: 5, total: 6, totalPages: 2 });
    expect(listing.issues).toHaveLength(1);
    expect(listing.issues[0].link).toBe(link);
    expect(Object.keys(listing.issues[0])).not.toContain('body');
    expect(Object.keys(listing.issues[0])).not.toContain('projectId');
  });

  it('builds an empty delete body', () => {
    expect(issueDeleteResponse()).toEqual({});
  });
});
