import ApiClient from '../../../../assets/js/client/ApiClient.js';
import LoginModalEvents from '../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../support/fakeWindow.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

describe('ApiClient.postJsonOnce', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    installFakeWindow({ location: { hash: '' } });
    spyOn(LoginModalEvents, 'open');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    uninstallFakeWindow();
  });

  it('posts a JSON body with same-origin credentials and resolves with the parsed body', async () => {
    globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { user: { id: 1 } } }]);

    const data = await ApiClient.postJsonOnce('/auth/refresh.json', { refreshToken: 'legacy' });

    expect(data).toEqual({ user: { id: 1 } });
    expect(globalThis.fetch).toHaveBeenCalledWith('/auth/refresh.json', jasmine.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify({ refreshToken: 'legacy' }),
    }));
  });

  it('throws an ApiError on a 401 without refreshing or opening the login modal', async () => {
    globalThis.fetch = fetchSequence([{
      ok: false, status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    }]);

    await expectAsync(ApiClient.postJsonOnce('/auth/refresh.json', {}))
      .toBeRejectedWith(jasmine.objectContaining({ status: 401, message: 'Unauthorized' }));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(LoginModalEvents.open).not.toHaveBeenCalled();
  });
});
