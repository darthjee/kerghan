import { githubIssue } from '../../integrations/tests/support/github-builders.js';
import { differencesOf, githubValues } from '../github-values.js';

describe('githubValues', () => {
  it('keeps the title verbatim, without trimming', () => {
    expect(githubValues(githubIssue({ title: '  Spaced  Title ' })).title).toBe('  Spaced  Title ');
  });

  it.each([
    ['a null body', null, null],
    ['an empty body', '', null],
    ['a whitespace-only body', '  \n ', '  \n '],
    ['a text body', 'text', 'text'],
  ])('maps %s', (_label, body, expected) => {
    expect(githubValues(githubIssue({ body })).body).toBe(expected);
  });

  it('keeps the state', () => {
    expect(githubValues(githubIssue({ state: 'closed' })).state).toBe('closed');
  });
});

describe('differencesOf', () => {
  const base = { title: 'T', body: 'B', state: 'open' as const };

  it('lists nothing when the values match', () => {
    expect(differencesOf(base, { ...base })).toEqual([]);
  });

  it('lists the differing fields in the order title, body, state', () => {
    expect(differencesOf(base, { title: 'U', body: 'C', state: 'closed' })).toEqual(['title', 'body', 'state']);
    expect(differencesOf(base, { ...base, state: 'closed' })).toEqual(['state']);
    expect(differencesOf(base, { ...base, title: 'U', state: 'closed' })).toEqual(['title', 'state']);
  });

  it('treats a NULL body as equal to an empty one', () => {
    expect(differencesOf({ ...base, body: null }, { ...base, body: '' })).toEqual([]);
    expect(differencesOf({ ...base, body: '' }, { ...base, body: null })).toEqual([]);
  });

  it('keeps whitespace significant and never folds case', () => {
    expect(differencesOf({ ...base, body: '  ' }, { ...base, body: null })).toEqual(['body']);
    expect(differencesOf({ ...base, title: 'Title' }, { ...base, title: 'title' })).toEqual(['title']);
    expect(differencesOf({ ...base, title: 'T ' }, { ...base, title: 'T' })).toEqual(['title']);
    expect(differencesOf({ ...base, body: 'B' }, { ...base, body: 'b' })).toEqual(['body']);
  });
});
