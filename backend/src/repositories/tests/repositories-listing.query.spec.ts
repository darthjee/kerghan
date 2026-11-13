import { currentKeys, escapeLike, sourceRef } from '../repositories-listing.query.js';

const integrations = [
  { id: 3, uuid: 'u3', label: 'l3', type: 'pat' as const },
  { id: 1, uuid: 'u1', label: 'l1', type: 'github_app' as const },
];

describe('escapeLike', () => {
  it('escapes %, _ and \\ so they match literally', () => {
    expect(escapeLike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
    expect(escapeLike('plain')).toBe('plain');
  });
});

describe('currentKeys', () => {
  it('lists the integrations in order, then the handle when set', () => {
    expect(currentKeys({ integrations, handle: 'me' })).toEqual(['integration:3', 'integration:1', 'handle']);
    expect(currentKeys({ integrations: [], handle: null })).toEqual([]);
  });
});

describe('sourceRef', () => {
  it('exposes an integration\'s uuid and label only, and the handle', () => {
    const scope = { integrations, handle: 'me' };

    expect(sourceRef(scope, 'integration:1')).toEqual({ kind: 'integration', integration: { uuid: 'u1', label: 'l1' } });
    expect(sourceRef(scope, 'handle')).toEqual({ kind: 'handle', handle: 'me' });
  });
});
