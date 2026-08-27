import ApiClient from '../../../../assets/js/client/ApiClient.js';
import ApiError from '../../../../assets/js/client/ApiError.js';

describe('ApiClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('posts a JSON body with same-origin credentials', async () => {
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
    });

    await ApiClient.postJson('/accounts/register.json', { username: 'foo' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/accounts/register.json', jasmine.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify({ username: 'foo' }),
    }));
  });

  it('resolves with the parsed JSON body on success', async () => {
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1, username: 'foo' }),
    });

    const data = await ApiClient.postJson('/accounts/register.json', { username: 'foo' });

    expect(data).toEqual({ id: 1, username: 'foo' });
  });

  it('throws an ApiError with the status and message on failure', async () => {
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'username is not available' }),
    });

    await expectAsync(ApiClient.postJson('/accounts/register.json', {}))
      .toBeRejectedWith(jasmine.objectContaining(
        { status: 400, message: 'username is not available' },
      ));
  });

  it('throws instances of ApiError', async () => {
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'bad request' }),
    });

    try {
      await ApiClient.postJson('/accounts/register.json', {});
      fail('expected postJson to throw');
    } catch (error) {
      expect(error instanceof ApiError).toBe(true);
    }
  });

  it('deletes a JSON body with same-origin credentials', async () => {
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
      ok: true,
      status: 204,
      json: () => Promise.resolve({}),
    });

    await ApiClient.deleteJson('/auth/logoff.json', { refreshToken: 'token' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/auth/logoff.json', jasmine.objectContaining({
      method: 'DELETE',
      credentials: 'same-origin',
      body: JSON.stringify({ refreshToken: 'token' }),
    }));
  });

  it('resolves with the parsed JSON body on a successful delete', async () => {
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
      ok: true,
      status: 204,
      json: () => Promise.resolve({}),
    });

    const data = await ApiClient.deleteJson('/auth/logoff.json', { refreshToken: 'token' });

    expect(data).toEqual({});
  });

  it('throws an ApiError with the status and message when a delete fails', async () => {
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'invalid refresh token' }),
    });

    await expectAsync(ApiClient.deleteJson('/auth/logoff.json', { refreshToken: 'token' }))
      .toBeRejectedWith(jasmine.objectContaining(
        { status: 401, message: 'invalid refresh token' },
      ));
  });
});
