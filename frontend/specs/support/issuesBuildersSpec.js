import {
  buildErrorBody, buildFailure, buildIssue, buildIssueListing, buildLink, buildPagination,
  buildProject, buildProjectListing, buildProjectRepository, ISSUE_ID, PROJECT_ID,
} from './issuesBuilders.js';
import { isUuid } from '../../assets/js/utils/validation/uuid.js';

describe('issuesBuilders support', () => {
  it('exposes well-formed uuids', () => {
    expect(isUuid(PROJECT_ID)).toBe(true);
    expect(isUuid(ISSUE_ID)).toBe(true);
  });

  describe('buildProjectRepository', () => {
    it('defaults to the added darthjee/kerghan repository', () => {
      expect(buildProjectRepository()).toEqual(jasmine.objectContaining({
        fullName: 'darthjee/kerghan', status: 'added', private: false,
      }));
    });

    it('applies overrides', () => {
      expect(buildProjectRepository({ status: 'unavailable' }).status).toBe('unavailable');
    });
  });

  describe('buildProject', () => {
    it('defaults to a project with a repository', () => {
      expect(buildProject()).toEqual(jasmine.objectContaining({
        id: PROJECT_ID, name: 'Kerghan', openIssueCount: 0,
      }));
      expect(buildProject().repository.fullName).toBe('darthjee/kerghan');
    });

    it('applies overrides, including a null repository', () => {
      expect(buildProject({ repository: null }).repository).toBeNull();
    });
  });

  describe('buildLink', () => {
    it('defaults to a healthy link to issue 12', () => {
      expect(buildLink()).toEqual(jasmine.objectContaining({
        number: 12, state: 'linked', states: ['linked'], stale: false,
      }));
    });

    it('applies overrides', () => {
      expect(buildLink({ state: 'gone' }).state).toBe('gone');
    });
  });

  describe('buildIssue', () => {
    it('defaults to an open, unlinked issue', () => {
      expect(buildIssue()).toEqual(jasmine.objectContaining({ id: ISSUE_ID, state: 'open', link: null }));
    });

    it('applies overrides', () => {
      expect(buildIssue({ link: buildLink() }).link.number).toBe(12);
    });
  });

  describe('buildPagination', () => {
    it('defaults to one page of one row', () => {
      expect(buildPagination()).toEqual({ page: 1, perPage: 50, total: 1, totalPages: 1 });
    });

    it('applies overrides', () => {
      expect(buildPagination({ page: 3 }).page).toBe(3);
    });
  });

  describe('buildProjectListing', () => {
    it('defaults to one project and a matching total', () => {
      const listing = buildProjectListing();

      expect(listing.projects.length).toBe(1);
      expect(listing.pagination.total).toBe(1);
    });

    it('applies the given parts', () => {
      const pagination = buildPagination({ page: 2 });

      expect(buildProjectListing({ projects: [], pagination })).toEqual({ projects: [], pagination });
    });
  });

  describe('buildIssueListing', () => {
    it('defaults to one issue and a matching total', () => {
      const listing = buildIssueListing();

      expect(listing.issues.length).toBe(1);
      expect(listing.pagination.total).toBe(1);
    });

    it('applies the given parts', () => {
      expect(buildIssueListing({ issues: [] }).pagination.total).toBe(0);
    });
  });

  describe('buildErrorBody', () => {
    it('builds the standard error body', () => {
      expect(buildErrorBody(409, 'X')).toEqual(jasmine.objectContaining({
        statusCode: 409, error: { code: 'X', message: 'nope' },
      }));
    });

    it('merges the extra error fields', () => {
      expect(buildErrorBody(409, 'X', { meta: { a: 1 } }).error.meta).toEqual({ a: 1 });
    });
  });

  describe('buildFailure', () => {
    it('builds a failed response descriptor', () => {
      expect(buildFailure(404, 'NOT_FOUND')).toEqual({
        ok: false, status: 404, json: buildErrorBody(404, 'NOT_FOUND'),
      });
    });
  });
});
