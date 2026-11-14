import { githubRateLimited, githubUnavailable } from '../github-http-errors.js';

describe('github-http-errors', () => {
  it('answers 502 GITHUB_UNAVAILABLE', () => {
    const error = githubUnavailable();

    expect(error.getStatus()).toBe(502);
    expect(error.getResponse()).toEqual({
      code: 'GITHUB_UNAVAILABLE',
      message: 'GitHub is unavailable; try again later',
    });
  });

  it('answers 503 GITHUB_RATE_LIMITED with retryAfterSeconds', () => {
    const error = githubRateLimited(30);

    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toEqual({
      code: 'GITHUB_RATE_LIMITED',
      message: 'GitHub rate limit reached; try again later',
      retryAfterSeconds: 30,
    });
  });

  it('answers 503 GITHUB_RATE_LIMITED without retryAfterSeconds when none is given', () => {
    expect(githubRateLimited().getResponse()).toEqual({
      code: 'GITHUB_RATE_LIMITED',
      message: 'GitHub rate limit reached; try again later',
    });
  });
});
