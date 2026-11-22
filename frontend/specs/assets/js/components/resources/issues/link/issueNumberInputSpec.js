import IssueNumberInput from '../../../../../../../assets/js/components/resources/issues/link/issueNumberInput.js';

describe('IssueNumberInput', () => {
  const repository = { fullName: 'darthjee/kerghan' };
  const INVALID = 'Enter an issue number or GitHub issue URL';

  describe('.parse', () => {
    ['12', '#12', '  12  ', ' #12 ', 'https://github.com/darthjee/kerghan/issues/12', 'https://github.com/DarthJee/Kerghan/issues/12'].forEach((raw) => {
      it(`accepts "${raw}"`, () => {
        expect(IssueNumberInput.parse(raw, repository)).toEqual({ number: 12 });
      });
    });

    it('accepts a URL with a trailing slash', () => {
      expect(IssueNumberInput.parse('https://github.com/darthjee/kerghan/issues/7/', repository)).toEqual({ number: 7 });
    });

    it('rejects a URL of another repository', () => {
      expect(IssueNumberInput.parse('https://github.com/other/repo/issues/12', repository))
        .toEqual({ error: 'This issue is not in darthjee/kerghan' });
    });

    ['', '   ', 'abc', '0', '#0', '-3', '1.5', '12abc', '2147483648', '99999999999', 'https://github.com/darthjee/kerghan/pull/12',
      'https://example.com/darthjee/kerghan/issues/12', 'https://github.com/darthjee/kerghan/issues/0'].forEach((raw) => {
      it(`rejects "${raw}"`, () => {
        expect(IssueNumberInput.parse(raw, repository)).toEqual({ error: INVALID });
      });
    });

    it('accepts the largest number of the API', () => {
      expect(IssueNumberInput.parse('2147483647', repository)).toEqual({ number: 2147483647 });
    });

    it('rejects nothing-typed input', () => {
      expect(IssueNumberInput.parse(undefined, repository)).toEqual({ error: INVALID });
    });
  });
});
