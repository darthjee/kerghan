import { HANDLE_SOURCE_KEY, integrationSourceKey, parseSourceKey } from '../source-key.js';

describe('source keys', () => {
  it('builds an integration key', () => {
    expect(integrationSourceKey(42)).toBe('integration:42');
  });

  it('parses the handle key', () => {
    expect(HANDLE_SOURCE_KEY).toBe('handle');
    expect(parseSourceKey('handle')).toEqual({ kind: 'handle' });
  });

  it('parses an integration key', () => {
    expect(parseSourceKey(integrationSourceKey(7))).toEqual({ kind: 'integration', integrationId: 7 });
  });

  it.each(['integration:', 'integration:0', 'integration:x', 'integration:01', 'Handle', 'other'])('refuses %p', (key) => {
    expect(parseSourceKey(key)).toBeNull();
  });
});
