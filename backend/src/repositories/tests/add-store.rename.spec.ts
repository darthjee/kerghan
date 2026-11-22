import { FakeClock } from '../../core/tests/support/fake-clock.js';
import { AddStore } from '../add-store.js';

describe('AddStore#rename', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  let query: jest.Mock;
  let store: AddStore;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue({ affectedRows: 1 });
    store = new AddStore({ query } as never, new FakeClock(now));
  });

  it('updates owner and name of the caller\'s own row only, from the clock', async () => {
    await store.rename(7, 3, { owner: 'octo', name: 'renamed' });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain('UPDATE repositories SET owner = ?, name = ?, updated_at = ?');
    expect(sql).toContain('WHERE id = ? AND user_id = ?');
    expect(sql).not.toContain('added_at');
    expect(sql).not.toContain('integration_id');
    expect(params).toEqual(['octo', 'renamed', now, 3, 7, 'octo', 'renamed']);
  });

  it.each([
    ['an empty owner', { owner: '', name: 'r' }],
    ['an empty name', { owner: 'o', name: '' }],
    ['an owner longer than the column', { owner: 'o'.repeat(40), name: 'r' }],
    ['a name longer than the column', { owner: 'o', name: 'r'.repeat(101) }],
  ])('ignores %s', async (_label, renamedTo) => {
    await store.rename(7, 3, renamedTo);

    expect(query).not.toHaveBeenCalled();
  });

  it('accepts names at the column limits', async () => {
    await store.rename(7, 3, { owner: 'o'.repeat(39), name: 'r'.repeat(100) });

    expect(query).toHaveBeenCalledTimes(1);
  });
});
