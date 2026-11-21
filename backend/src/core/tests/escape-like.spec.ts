import { escapeLike } from '../escape-like.js';

describe('escapeLike', () => {
  it('escapes %, _ and \\ so they match literally', () => {
    expect(escapeLike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
    expect(escapeLike('plain')).toBe('plain');
  });
});
