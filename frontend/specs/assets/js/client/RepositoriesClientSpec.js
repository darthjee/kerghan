import RepositoriesClient from '../../../../assets/js/client/RepositoriesClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

describe('RepositoriesClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * Parse the JSON body of the first fetch call.
   *
   * @returns {object} The parsed request body.
   */
  function sentBody() {
    return JSON.parse(globalThis.fetch.calls.argsFor(0)[1].body);
  }

  /**
   * Build a failed-response descriptor with the standard error body.
   *
   * @param {number} status - HTTP status.
   * @param {string} code - Error code.
   * @param {object} [extra] - Extra error fields and headers.
   * @returns {object} The response descriptor.
   */
  function failure(status, code, { headers, ...fields } = {}) {
    return {
      ok: false, status, headers, json: { error: { code, message: 'nope', ...fields }, statusCode: status },
    };
  }

  describe('.list', () => {
    it('posts the given fields to the mine endpoint', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { repositories: [] } }]);

      const response = await RepositoriesClient.list({
        page: 2, perPage: 25, filter: 'added', search: 'kerg',
      });

      expect(globalThis.fetch.calls.argsFor(0)[0]).toBe('/repositories/mine.json');
      expect(globalThis.fetch.calls.argsFor(0)[1].method).toBe('POST');
      expect(sentBody()).toEqual({ page: 2, perPage: 25, filter: 'added', search: 'kerg' });
      expect(response).toEqual({ repositories: [] });
    });

    it('omits undefined fields and an empty search', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: {} }]);

      await RepositoriesClient.list({ page: 1, search: '' });

      expect(sentBody()).toEqual({ page: 1 });
    });

    it('sends an empty body without options', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: {} }]);

      await RepositoriesClient.list();

      expect(sentBody()).toEqual({});
    });

    it('rejects with an ApiError on a 400', async () => {
      globalThis.fetch = fetchSequence([failure(400, 'VALIDATION_FAILED')]);

      await expectAsync(RepositoriesClient.list({ page: 0 }))
        .toBeRejectedWith(jasmine.objectContaining({ status: 400, code: 'VALIDATION_FAILED' }));
    });
  });

  describe('.syncState', () => {
    it('posts an empty body to the state endpoint', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { state: 'idle' } }]);

      const response = await RepositoriesClient.syncState();

      expect(globalThis.fetch.calls.argsFor(0)[0]).toBe('/repositories/sync/state.json');
      expect(sentBody()).toEqual({});
      expect(response).toEqual({ state: 'idle' });
    });

    it('rejects with an ApiError on a 503', async () => {
      globalThis.fetch = fetchSequence([failure(503, 'SERVICE_UNAVAILABLE')]);

      await expectAsync(RepositoriesClient.syncState())
        .toBeRejectedWith(jasmine.objectContaining({ status: 503 }));
    });
  });

  describe('.refresh', () => {
    it('posts an empty body to the sync endpoint and accepts a 202', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 202, json: { state: 'syncing' } }]);

      const response = await RepositoriesClient.refresh();

      expect(globalThis.fetch.calls.argsFor(0)[0]).toBe('/repositories/sync.json');
      expect(sentBody()).toEqual({});
      expect(response).toEqual({ state: 'syncing' });
    });

    it('carries the body retryAfterSeconds on a 429', async () => {
      globalThis.fetch = fetchSequence([
        failure(429, 'REPOSITORY_REFRESH_COOLDOWN', { retryAfterSeconds: 120 }),
      ]);

      await expectAsync(RepositoriesClient.refresh()).toBeRejectedWith(jasmine.objectContaining({
        status: 429, code: 'REPOSITORY_REFRESH_COOLDOWN', retryAfterSeconds: 120,
      }));
    });

    it('falls back to the Retry-After header on a 429 without a body value', async () => {
      globalThis.fetch = fetchSequence([
        failure(429, 'REPOSITORY_REFRESH_COOLDOWN', { headers: { 'Retry-After': '45' } }),
      ]);

      await expectAsync(RepositoriesClient.refresh()).toBeRejectedWith(jasmine.objectContaining({
        status: 429, retryAfter: 45, retryAfterSeconds: 45,
      }));
    });
  });

  describe('.add', () => {
    it('posts the githubId to the add endpoint', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { githubId: 7 } }]);

      const response = await RepositoriesClient.add(7);

      expect(globalThis.fetch.calls.argsFor(0)[0]).toBe('/repositories/add.json');
      expect(sentBody()).toEqual({ githubId: 7 });
      expect(response).toEqual({ githubId: 7 });
    });

    [
      [404, 'NOT_FOUND'],
      [409, 'REPOSITORY_SOURCE_UNUSABLE'],
      [429, 'REPOSITORY_ADD_RATE_LIMITED'],
      [502, 'GITHUB_UNAVAILABLE'],
      [503, 'GITHUB_RATE_LIMITED'],
    ].forEach(([status, code]) => {
      it(`rejects with an ApiError on ${status} ${code}`, async () => {
        globalThis.fetch = fetchSequence([failure(status, code)]);

        await expectAsync(RepositoriesClient.add(7))
          .toBeRejectedWith(jasmine.objectContaining({ status, code }));
      });
    });
  });
});
