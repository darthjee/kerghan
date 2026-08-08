import ApiError from '../../../../assets/js/client/ApiError.js';

describe('ApiError', () => {
  it('carries the response status', () => {
    const error = new ApiError(400, 'username is not available');

    expect(error.status).toBe(400);
  });

  it('carries the backend message', () => {
    const error = new ApiError(400, 'username is not available');

    expect(error.message).toBe('username is not available');
  });

  it('is an instance of Error', () => {
    const error = new ApiError(400, 'username is not available');

    expect(error instanceof Error).toBe(true);
  });
});
