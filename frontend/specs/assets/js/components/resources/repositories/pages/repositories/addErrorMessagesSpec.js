import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import AddErrorMessages from '../../../../../../../../assets/js/components/resources/repositories/pages/repositories/addErrorMessages.js';

describe('AddErrorMessages', () => {
  it('maps a 404', () => {
    expect(AddErrorMessages.describe(new ApiError(404, 'x', 'NOT_FOUND')))
      .toEqual({ message: 'Repository not found on GitHub.' });
  });

  [502, 503].forEach((status) => {
    it(`maps a ${status}`, () => {
      expect(AddErrorMessages.describe(new ApiError(status, 'x')).message)
        .toBe('GitHub is unavailable or rate limited — try again later.');
    });
  });

  it('maps a 409 REPOSITORY_SOURCE_UNUSABLE with the Integrations link', () => {
    const result = AddErrorMessages.describe(new ApiError(409, 'x', 'REPOSITORY_SOURCE_UNUSABLE'));

    expect(result.message).toContain('Fix the integration');
    expect(result.link).toEqual({ href: '#/account/integrations', text: 'Integrations' });
  });

  it('maps a 429 with the retry seconds', () => {
    const error = new ApiError(429, 'x', 'REPOSITORY_ADD_RATE_LIMITED', undefined, undefined, 12);

    expect(AddErrorMessages.describe(error).message)
      .toBe('Too many repositories added — try again in 12 s.');
  });

  it('maps a 429 without retry seconds', () => {
    expect(AddErrorMessages.describe(new ApiError(429, 'x')).message)
      .toBe('Too many repositories added — try again shortly.');
  });

  it('falls back to the error message', () => {
    expect(AddErrorMessages.describe(new ApiError(500, 'Boom'))).toEqual({ message: 'Boom' });
  });

  it('falls back to a generic message', () => {
    expect(AddErrorMessages.describe(undefined)).toEqual({ message: 'Request failed' });
  });
});
