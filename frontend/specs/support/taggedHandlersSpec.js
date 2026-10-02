import { taggedHandlers } from './taggedHandlers.js';

describe('taggedHandlers support', () => {
  it('tags each call with the handler name and its arguments', () => {
    const handlers = taggedHandlers();

    expect(handlers.onTest('abc')).toBe('onTest:abc');
    expect(handlers.onReplaceCredentialChange('abc', 'token')).toBe('onReplaceCredentialChange:abc:token');
  });

  it('tags an integration argument by its id', () => {
    expect(taggedHandlers().onStartRename({ id: 'abc' })).toBe('onStartRename:abc');
  });
});
