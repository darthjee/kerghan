import SavedIssueSignal from '../../../../../../../assets/js/components/resources/issues/sync/savedIssueSignal.js';

describe('SavedIssueSignal', () => {
  afterEach(() => {
    SavedIssueSignal.consume('anything');
  });

  it('answers the recorded issue once for the matching id', () => {
    const issue = { id: 'a' };

    SavedIssueSignal.record('a', issue);

    expect(SavedIssueSignal.consume('a')).toBe(issue);
    expect(SavedIssueSignal.consume('a')).toBeUndefined();
  });

  it('answers nothing for another id and clears the record', () => {
    SavedIssueSignal.record('a', { id: 'a' });

    expect(SavedIssueSignal.consume('b')).toBeUndefined();
    expect(SavedIssueSignal.consume('a')).toBeUndefined();
  });

  it('answers nothing when nothing was recorded', () => {
    expect(SavedIssueSignal.consume('a')).toBeUndefined();
  });

  it('keeps the latest record', () => {
    SavedIssueSignal.record('a', { v: 1 });
    SavedIssueSignal.record('a', { v: 2 });

    expect(SavedIssueSignal.consume('a')).toEqual({ v: 2 });
  });
});
