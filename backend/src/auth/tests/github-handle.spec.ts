import { isValidGithubHandle, normalizeGithubHandle } from '../github-handle.js';

describe('normalizeGithubHandle', () => {
  it.each([
    ['  @DarthJee ', 'darthjee'],
    ['darthjee', 'darthjee'],
    ['DARTHJEE', 'darthjee'],
    ['@darthjee', 'darthjee'],
    ['@@darthjee', '@darthjee'],
  ])('normalises %p to %p', (input, expected) => {
    expect(normalizeGithubHandle(input)).toBe(expected);
  });

  it.each(['', '  ', '@', ' @ '])('normalises %p to null (clear)', (input) => {
    expect(normalizeGithubHandle(input)).toBeNull();
  });

  it('keeps null as null', () => {
    expect(normalizeGithubHandle(null)).toBeNull();
  });
});

describe('isValidGithubHandle', () => {
  it.each(['a', 'a-b', 'a1-b2-c3', '0', 'a'.repeat(39)])('accepts %p', (handle) => {
    expect(isValidGithubHandle(handle)).toBe(true);
  });

  it.each(['a'.repeat(40), '-a', 'a-', 'a--b', 'a_b', 'a.b', 'a/b', 'a b', 'ä', 'é', 'A', '@a', ''])(
    'rejects %p',
    (handle) => {
      expect(isValidGithubHandle(handle)).toBe(false);
    },
  );
});
