import type { IssueValues } from '../github-values.js';
import { mergeFields, type MergeInput } from '../issue-sync-merge.js';

const BASE: IssueValues = { title: 'T', body: 'B', state: 'open' };
const EARLY = new Date('2026-06-01T10:00:00Z');
const LATE = new Date('2026-06-01T12:00:00Z');

function input(overrides: Partial<MergeInput> & { local?: Partial<IssueValues>; remote?: Partial<IssueValues> } = {}): MergeInput {
  const { local, remote, ...rest } = overrides;

  return {
    local: { ...BASE, ...local },
    base: BASE,
    remote: { ...BASE, ...remote },
    localEditedAt: EARLY,
    remoteUpdatedAt: EARLY,
    ...rest,
  };
}

// The L/B/G table of `sync.md#reconcile`, one row per case, on the title.
describe('mergeFields', () => {
  it('does nothing when neither side moved', () => {
    expect(mergeFields(input())).toEqual({ push: {}, pull: {}, adopt: {} });
  });

  it('pulls when only GitHub moved', () => {
    expect(mergeFields(input({ remote: { title: 'G' } }))).toEqual({ push: {}, pull: { title: 'G' }, adopt: {} });
  });

  it('pushes when only Kerghan moved', () => {
    expect(mergeFields(input({ local: { title: 'L' } }))).toEqual({ push: { title: 'L' }, pull: {}, adopt: {} });
  });

  it('adopts when both moved to the same value (E8): nothing is sent', () => {
    expect(mergeFields(input({ local: { state: 'closed' }, remote: { state: 'closed' } }))).toEqual({
      push: {},
      pull: {},
      adopt: { state: 'closed' },
    });
  });

  describe('both moved to different values (E7)', () => {
    const conflict = { local: { title: 'L' }, remote: { title: 'G' } };

    it('Kerghan newer: pushes', () => {
      expect(mergeFields(input({ ...conflict, localEditedAt: LATE, remoteUpdatedAt: EARLY }))).toEqual({
        push: { title: 'L' }, pull: {}, adopt: {},
      });
    });

    it('GitHub newer: pulls, and drops the field from the push', () => {
      expect(mergeFields(input({ ...conflict, localEditedAt: EARLY, remoteUpdatedAt: LATE }))).toEqual({
        push: {}, pull: { title: 'G' }, adopt: {},
      });
    });

    it('a tie goes to Kerghan', () => {
      expect(mergeFields(input({ ...conflict, localEditedAt: LATE, remoteUpdatedAt: LATE }))).toEqual({
        push: { title: 'L' }, pull: {}, adopt: {},
      });
    });
  });

  it('decides each field on its own', () => {
    const plan = mergeFields(input({
      local: { title: 'L', state: 'closed' },
      remote: { body: 'G', state: 'open' },
    }));

    expect(plan).toEqual({ push: { title: 'L', state: 'closed' }, pull: { body: 'G' }, adopt: {} });
  });

  it('mixes a pull, a push and an adopt in one run', () => {
    const plan = mergeFields(input({
      local: { title: 'L', state: 'closed' },
      remote: { body: 'G', state: 'closed' },
    }));

    expect(plan).toEqual({ push: { title: 'L' }, pull: { body: 'G' }, adopt: { state: 'closed' } });
  });

  describe('body normalization', () => {
    it('treats NULL and an empty body as the same value: nothing happens', () => {
      expect(mergeFields({ ...input(), base: { ...BASE, body: null }, local: { ...BASE, body: null }, remote: { ...BASE, body: '' } }))
        .toEqual({ push: {}, pull: {}, adopt: {} });
      expect(mergeFields({ ...input(), base: { ...BASE, body: '' }, local: { ...BASE, body: '' }, remote: { ...BASE, body: null } }))
        .toEqual({ push: {}, pull: {}, adopt: {} });
    });

    it('treats a body emptied on one side as a change', () => {
      expect(mergeFields(input({ local: { body: null } }))).toEqual({ push: { body: null }, pull: {}, adopt: {} });
      expect(mergeFields(input({ remote: { body: null } }))).toEqual({ push: {}, pull: { body: null }, adopt: {} });
    });

    it('applies no other normalization: whitespace and case are changes', () => {
      expect(mergeFields(input({ remote: { body: 'B ' } })).pull).toEqual({ body: 'B ' });
      expect(mergeFields(input({ local: { title: 't' } })).push).toEqual({ title: 't' });
    });
  });

  it('never reads or invents any field beyond the three', () => {
    const plan = mergeFields(input({ local: { title: 'L' }, remote: { body: 'G' } }));

    expect(Object.keys({ ...plan.push, ...plan.pull, ...plan.adopt }).sort()).toEqual(['body', 'title']);
  });
});
