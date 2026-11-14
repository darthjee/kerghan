import AccountsClient from '../../../../assets/js/client/AccountsClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';
import ApiError from '../../../../assets/js/client/ApiError.js';
import AuthSession from '../../../../assets/js/client/AuthSession.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

describe('AccountsClient github handle', () => {
  const account = { username: 'foo', email: 'foo@example.com', githubHandle: 'octocat' };
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    spyOn(AuthSession, 'isLoggedIn').and.returnValue(true);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * Install a fetch stub answering with the given response.
   *
   * @param {object} response - The fake response descriptor.
   * @returns {jasmine.Spy} The fetch spy.
   */
  function stubFetch(response) {
    globalThis.fetch = fetchSequence([response]);

    return globalThis.fetch;
  }

  describe('.getMyAccount', () => {
    it('posts an empty body to the mine endpoint and resolves with the account', async () => {
      const fetchSpy = stubFetch({ ok: true, status: 200, json: account });

      const result = await AccountsClient.getMyAccount();

      const [url, options] = fetchSpy.calls.mostRecent().args;

      expect(url).toContain('/auth/account/mine.json');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({});
      expect(result).toEqual(account);
    });

    it('rejects with an ApiError carrying the error message', async () => {
      stubFetch({
        ok: false, status: 500, json: { error: { code: 'x', message: 'boom' } },
      });

      const error = await AccountsClient.getMyAccount().catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('boom');
    });
  });

  describe('.updateGithubHandle', () => {
    it('patches only the handle', async () => {
      const fetchSpy = stubFetch({ ok: true, status: 200, json: account });

      const result = await AccountsClient.updateGithubHandle('octocat');

      const [url, options] = fetchSpy.calls.mostRecent().args;

      expect(url).toContain('/auth/account.json');
      expect(options.method).toBe('PATCH');
      expect(JSON.parse(options.body)).toEqual({ githubHandle: 'octocat' });
      expect(result).toEqual(account);
    });

    it('sends null to clear the handle', async () => {
      const fetchSpy = stubFetch({
        ok: true, status: 200, json: { ...account, githubHandle: null },
      });

      await AccountsClient.updateGithubHandle(null);

      expect(JSON.parse(fetchSpy.calls.mostRecent().args[1].body)).toEqual({ githubHandle: null });
    });

    it('rejects with an ApiError carrying the error message', async () => {
      stubFetch({
        ok: false, status: 400, json: { error: { code: 'bad', message: 'Invalid handle' } },
      });

      const error = await AccountsClient.updateGithubHandle('-x').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Invalid handle');
    });
  });

  describe('.updateAccount', () => {
    it('never sends githubHandle', async () => {
      spyOn(ApiClient, 'patchJson').and.resolveTo(account);

      await AccountsClient.updateAccount({
        currentPassword: 'secret', username: 'foo', githubHandle: 'octocat',
      });

      expect(ApiClient.patchJson).toHaveBeenCalledWith('/auth/account.json', {
        currentPassword: 'secret', username: 'foo',
      });
    });
  });
});
