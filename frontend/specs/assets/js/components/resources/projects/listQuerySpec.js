import ListQuery, { MAX_SEARCH_LENGTH } from '../../../../../../assets/js/components/resources/projects/listQuery.js';

describe('ListQuery', () => {
  const STATES = ['open', 'closed', 'all'];

  describe('.parse', () => {
    it('defaults to page 1 and an empty search', () => {
      expect(ListQuery.parse('#/projects')).toEqual({ page: 1, search: '' });
      expect(ListQuery.parse('')).toEqual({ page: 1, search: '' });
    });

    it('reads page and search', () => {
      expect(ListQuery.parse('#/projects?search=foo%20bar&page=3')).toEqual({ page: 3, search: 'foo bar' });
    });

    ['0', '-1', 'abc', '1.5', '', '1e3', '9999999999999999999999'].forEach((page) => {
      it(`normalizes page=${page} to 1 (U6)`, () => {
        expect(ListQuery.parse(`#/projects?page=${page}`).page).toBe(1);
      });
    });

    it('truncates a search over 100 code points (U6)', () => {
      expect(ListQuery.parse(`#/projects?search=${'x'.repeat(150)}`).search.length).toBe(MAX_SEARCH_LENGTH);
    });

    it('counts code points, not UTF-16 units, when truncating', () => {
      const search = ListQuery.parse(`#/projects?search=${encodeURIComponent('😀'.repeat(150))}`).search;

      expect(Array.from(search).length).toBe(100);
    });

    it('reads no state without a state filter', () => {
      expect('state' in ListQuery.parse('#/projects?state=closed')).toBe(false);
    });

    it('reads an allowed state', () => {
      expect(ListQuery.parse('#/p?state=closed', { states: STATES }).state).toBe('closed');
    });

    it('falls back to the default state for an unknown or missing one (U6)', () => {
      expect(ListQuery.parse('#/p?state=foo', { states: STATES }).state).toBe('open');
      expect(ListQuery.parse('#/p', { states: STATES }).state).toBe('open');
    });

    it('keeps a literal question mark of the value', () => {
      expect(ListQuery.parse('#/p?search=a?b').search).toBe('a?b');
    });
  });

  describe('.toHash', () => {
    it('leaves the defaults out', () => {
      expect(ListQuery.toHash('/projects', { page: 1, search: '' })).toBe('#/projects');
    });

    it('writes search and page', () => {
      expect(ListQuery.toHash('/projects', { page: 2, search: 'a b' })).toBe('#/projects?search=a+b&page=2');
    });

    it('writes a non-default state, and leaves the default out', () => {
      const query = { page: 1, search: '', state: 'closed' };

      expect(ListQuery.toHash('/p', query, { states: STATES })).toBe('#/p?state=closed');
      expect(ListQuery.toHash('/p', { ...query, state: 'open' }, { states: STATES })).toBe('#/p');
    });

    it('round-trips through parse', () => {
      const query = { page: 4, search: 'x&y=z', state: 'all' };
      const hash = ListQuery.toHash('/p', query, { states: STATES });

      expect(ListQuery.parse(hash, { states: STATES })).toEqual(query);
    });
  });

  describe('.truncateSearch', () => {
    it('keeps a short text and cuts a long one', () => {
      expect(ListQuery.truncateSearch('abc')).toBe('abc');
      expect(ListQuery.truncateSearch('y'.repeat(101)).length).toBe(100);
    });
  });
});
