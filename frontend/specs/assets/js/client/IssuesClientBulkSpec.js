import IssuesClient from '../../../../assets/js/client/IssuesClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';
import { buildFailure, ISSUE_ID, PROJECT_ID } from '../../../support/issuesBuilders.js';

describe('IssuesClient', () => {
  let originalFetch;

  const base = `/projects/${PROJECT_ID}/issues`;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const answer = (json = {}) => {
    globalThis.fetch = fetchSequence([{ ok: true, status: 200, json }]);
  };
  const fail = (status, code, extra) => {
    globalThis.fetch = fetchSequence([buildFailure(status, code, extra)]);
  };
  const sentPath = () => globalThis.fetch.calls.argsFor(0)[0];
  const sentBody = () => JSON.parse(globalThis.fetch.calls.argsFor(0)[1].body);

  describe('.bulkState', () => {
    it('posts the ids and the state to the bulk-state endpoint', async () => {
      const result = { state: 'closed', changed: [ISSUE_ID], unchanged: [], notFound: [] };

      answer(result);

      const response = await IssuesClient.bulkState(PROJECT_ID, { issueIds: [ISSUE_ID], state: 'closed' });

      expect(sentPath()).toBe(`${base}/bulk-state.json`);
      expect(globalThis.fetch.calls.argsFor(0)[1].method).toBe('POST');
      expect(sentBody()).toEqual({ issueIds: [ISSUE_ID], state: 'closed' });
      expect(response).toEqual(result);
    });

    it('maps ISSUE_EDIT_RATE_LIMITED with meta.retryAfterSeconds', async () => {
      fail(429, 'ISSUE_EDIT_RATE_LIMITED', { retryAfterSeconds: 30 });

      await expectAsync(IssuesClient.bulkState(PROJECT_ID, { issueIds: [ISSUE_ID], state: 'open' }))
        .toBeRejectedWith(jasmine.objectContaining({ status: 429, code: 'ISSUE_EDIT_RATE_LIMITED', retryAfterSeconds: 30 }));
    });

    it('maps a 404', async () => {
      fail(404, 'PROJECT_NOT_FOUND');

      await expectAsync(IssuesClient.bulkState(PROJECT_ID, { issueIds: [ISSUE_ID], state: 'open' }))
        .toBeRejectedWith(jasmine.objectContaining({ status: 404, code: 'PROJECT_NOT_FOUND' }));
    });

    it('rejects a non-uuid project id without sending a request', async () => {
      answer();

      await expectAsync(IssuesClient.bulkState('a/b', { issueIds: [ISSUE_ID], state: 'open' }))
        .toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
      expect(globalThis.fetch.calls.count()).toBe(0);
    });
  });
});
