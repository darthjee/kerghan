import ApiClient from '../../../../assets/js/client/ApiClient.js';
import ApiError from '../../../../assets/js/client/ApiError.js';
import AuthSession from '../../../../assets/js/client/AuthSession.js';

/**
 * Build a fake `fetch` `Response`-like object whose `json`/`text` behave like a real one: an
 * empty body cannot be parsed as JSON (`json()` rejects, mirroring `SyntaxError: Unexpected
 * end of JSON input`), while a non-empty body is serialized/parsed for real.
 *
 * @param {{ok: boolean, status: number, json: object|undefined}} descriptor - Response shape;
 *   `json` is omitted (or `undefined`) to simulate a truly empty body, e.g. a `204`.
 * @returns {{ok: boolean, status: number, json: Function, text: Function}} The fake response.
 */
function fakeResponse({ json, ...rest }) {
  const body = json === undefined ? '' : JSON.stringify(json);

  return {
    ...rest,
    text: () => Promise.resolve(body),
    json: () => (body === '' ? Promise.reject(new SyntaxError('Unexpected end of JSON input')) : Promise.resolve(JSON.parse(body))),
  };
}

/**
 * Build a `fetch` spy that resolves with the given responses in order, one per call.
 *
 * @param {Array<{ok: boolean, status: number, json: object}>} responses - Ordered responses.
 * @returns {jasmine.Spy} The `fetch` spy.
 */
function fetchSequence(responses) {
  let call = 0;

  return jasmine.createSpy('fetch').and.callFake(() => {
    const response = fakeResponse(responses[call]);
    call += 1;
    return Promise.resolve(response);
  });
}

describe('ApiClient', () => {
  let originalFetch;
  let originalWindow;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalWindow = globalThis.window;
    globalThis.window = { location: { hash: '' } };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  });

  describe('.postJson', () => {
    it('posts a JSON body with same-origin credentials', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { id: 1 } }]);

      await ApiClient.postJson('/accounts/register.json', { username: 'foo' });

      expect(globalThis.fetch).toHaveBeenCalledWith('/accounts/register.json', jasmine.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ username: 'foo' }),
      }));
    });

    it('resolves with the parsed JSON body on success', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { id: 1, username: 'foo' } }]);

      const data = await ApiClient.postJson('/accounts/register.json', { username: 'foo' });

      expect(data).toEqual({ id: 1, username: 'foo' });
    });

    it('throws an ApiError with the status and message on a non-401 failure', async () => {
      globalThis.fetch = fetchSequence([{ ok: false, status: 400, json: { error: 'username is not available' } }]);

      await expectAsync(ApiClient.postJson('/accounts/register.json', {}))
        .toBeRejectedWith(jasmine.objectContaining(
          { status: 400, message: 'username is not available' },
        ));
    });

    it('throws instances of ApiError', async () => {
      globalThis.fetch = fetchSequence([{ ok: false, status: 400, json: { error: 'bad request' } }]);

      try {
        await ApiClient.postJson('/accounts/register.json', {});
        fail('expected postJson to throw');
      } catch (error) {
        expect(error instanceof ApiError).toBe(true);
      }
    });
  });

  describe('.deleteJson', () => {
    it('deletes a JSON body with same-origin credentials', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 204 }]);

      await ApiClient.deleteJson('/auth/logoff.json', { refreshToken: 'token' });

      expect(globalThis.fetch).toHaveBeenCalledWith('/auth/logoff.json', jasmine.objectContaining({
        method: 'DELETE',
        credentials: 'same-origin',
        body: JSON.stringify({ refreshToken: 'token' }),
      }));
    });

    it('resolves without throwing on a 204 response with a truly empty body, the way a ' +
      'real `fetch` behaves for DELETE /auth/logoff.json', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 204 }]);

      const data = await ApiClient.deleteJson('/auth/logoff.json', { refreshToken: 'token' });

      expect(data).toEqual({});
    });
  });

  describe('401 handling', () => {
    it('refreshes the access token and retries the original request on success', async () => {
      spyOn(AuthSession, 'get').and.returnValue('old-refresh-token');
      spyOn(AuthSession, 'set');
      spyOn(AuthSession, 'clear');
      globalThis.fetch = fetchSequence([
        { ok: false, status: 401, json: { error: 'unauthorized' } },
        { ok: true, status: 200, json: { user: { id: 1 }, refreshToken: 'new-refresh-token' } },
        { ok: true, status: 200, json: { id: 1, username: 'foo' } },
      ]);

      const data = await ApiClient.postJson('/accounts/register.json', { username: 'foo' });

      expect(data).toEqual({ id: 1, username: 'foo' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
      expect(globalThis.fetch.calls.argsFor(1)[0]).toBe('/auth/refresh.json');
      expect(AuthSession.set).toHaveBeenCalledWith('new-refresh-token');
      expect(AuthSession.clear).not.toHaveBeenCalled();
      expect(globalThis.window.location.hash).toBe('');
    });

    it('treats a failed refresh as a session expiry: clears the session and redirects to login', async () => {
      spyOn(AuthSession, 'get').and.returnValue('old-refresh-token');
      spyOn(AuthSession, 'clear');
      globalThis.fetch = fetchSequence([
        { ok: false, status: 401, json: { error: 'unauthorized' } },
        { ok: false, status: 401, json: { error: 'invalid refresh token' } },
      ]);

      const data = await ApiClient.postJson('/accounts/register.json', { username: 'foo' });

      expect(data).toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(AuthSession.clear).toHaveBeenCalled();
      expect(globalThis.window.location.hash).toBe('/login');
    });

    it('treats a missing refresh token as a session expiry, without attempting a refresh call', async () => {
      spyOn(AuthSession, 'get').and.returnValue(null);
      spyOn(AuthSession, 'clear');
      globalThis.fetch = fetchSequence([
        { ok: false, status: 401, json: { error: 'unauthorized' } },
      ]);

      const data = await ApiClient.postJson('/accounts/register.json', { username: 'foo' });

      expect(data).toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(AuthSession.clear).toHaveBeenCalled();
      expect(globalThis.window.location.hash).toBe('/login');
    });

    it('does not attempt a second refresh when the retried request also returns 401', async () => {
      spyOn(AuthSession, 'get').and.returnValue('old-refresh-token');
      spyOn(AuthSession, 'set');
      spyOn(AuthSession, 'clear');
      globalThis.fetch = fetchSequence([
        { ok: false, status: 401, json: { error: 'unauthorized' } },
        { ok: true, status: 200, json: { user: { id: 1 }, refreshToken: 'new-refresh-token' } },
        { ok: false, status: 401, json: { error: 'unauthorized' } },
      ]);

      const data = await ApiClient.postJson('/accounts/register.json', { username: 'foo' });

      expect(data).toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
      expect(AuthSession.clear).toHaveBeenCalled();
      expect(globalThis.window.location.hash).toBe('/login');
    });
  });
});
