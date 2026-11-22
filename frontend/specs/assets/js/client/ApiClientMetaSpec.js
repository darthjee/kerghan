import ApiClient from '../../../../assets/js/client/ApiClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

describe('ApiClient error meta', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * Fail a request with an error body carrying the given `meta`.
   *
   * @param {*} meta - The `error.meta` value.
   * @returns {Promise<void>} Resolves once the call rejected.
   */
  function rejectedWith(meta) {
    globalThis.fetch = fetchSequence([{
      ok: false, status: 409, json: { error: { code: 'X', message: 'nope', meta }, statusCode: 409 },
    }]);

    return ApiClient.postJson('/x.json', {});
  }

  it('carries error.meta onto the ApiError', async () => {
    await expectAsync(rejectedWith({ projectId: 'abc', linkCount: 3 }))
      .toBeRejectedWith(jasmine.objectContaining({ meta: { projectId: 'abc', linkCount: 3 } }));
  });

  it('leaves meta undefined when the body has none', async () => {
    await expectAsync(rejectedWith(undefined))
      .toBeRejectedWith(jasmine.objectContaining({ meta: undefined }));
  });

  [null, 'text', 5, ['a']].forEach((value) => {
    it(`ignores a non-object meta (${JSON.stringify(value)})`, async () => {
      await expectAsync(rejectedWith(value))
        .toBeRejectedWith(jasmine.objectContaining({ meta: undefined }));
    });
  });
});
