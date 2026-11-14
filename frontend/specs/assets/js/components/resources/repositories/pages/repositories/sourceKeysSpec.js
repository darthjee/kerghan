import SourceKeys from '../../../../../../../../assets/js/components/resources/repositories/pages/repositories/sourceKeys.js';
import { buildSource } from '../../../../../../../support/repositoriesBuilders.js';

describe('SourceKeys', () => {
  const handle = { kind: 'handle', handle: 'darthjee', status: 'not_found', syncedAt: 'T1' };

  it('keys an integration source by uuid', () => {
    expect(SourceKeys.keyOf(buildSource())).toBe('integration:uuid-1');
  });

  it('keys a handle source by handle', () => {
    expect(SourceKeys.keyOf(handle)).toBe('handle:darthjee');
  });

  it('builds the dismissal key from key, status and syncedAt', () => {
    expect(SourceKeys.dismissalKey(handle)).toBe('handle:darthjee|not_found|T1');
  });

  it('labels an integration source', () => {
    expect(SourceKeys.labelOf(buildSource())).toBe('integration "work-pat"');
  });

  it('labels a handle source', () => {
    expect(SourceKeys.labelOf(handle)).toBe('GitHub handle "darthjee"');
  });
});
