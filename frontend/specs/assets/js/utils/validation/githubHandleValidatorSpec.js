import { isValidGithubHandle } from '../../../../../assets/js/utils/validation/fieldValidators.js';

describe('isValidGithubHandle', () => {
  ['octocat', 'DarthJee', '@DarthJee', 'a', 'a-b', 'a1-b2', 'a'.repeat(39)].forEach((value) => {
    it(`accepts ${value}`, () => {
      expect(isValidGithubHandle(value)).toBe(true);
    });
  });

  ['', '--', '-a', 'a-', 'a--b', 'a'.repeat(40), '@@x', 'a_b', 'a b', 'a/b', '@'].forEach((value) => {
    it(`rejects "${value}"`, () => {
      expect(isValidGithubHandle(value)).toBe(false);
    });
  });
});
