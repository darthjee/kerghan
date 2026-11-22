import { buildSavedRereadEffect } from '../../../../../../../../assets/js/components/resources/issues/pages/show/useSavedIssueReread.js';
import SavedIssueSignal from '../../../../../../../../assets/js/components/resources/issues/sync/savedIssueSignal.js';
import { buildIssue, buildLink, ISSUE_ID } from '../../../../../../../support/issuesBuilders.js';

describe('useSavedIssueReread', () => {
  let reread;
  let taken;

  beforeEach(() => {
    reread = jasmine.createSpyObj('reread', ['start', 'dispose']);
    taken = { current: undefined };
  });

  afterEach(() => {
    SavedIssueSignal.consume(ISSUE_ID);
  });

  describe('buildSavedRereadEffect', () => {
    it('starts the bounded re-read with the saved issue as the trigger, and stops it on cleanup', () => {
      const saved = buildIssue({ link: buildLink({ state: 'pending', states: ['pending'] }) });

      SavedIssueSignal.record(ISSUE_ID, saved);
      const cleanup = buildSavedRereadEffect(reread, ISSUE_ID, taken)();

      expect(reread.start).toHaveBeenCalledOnceWith(saved);
      cleanup();
      expect(reread.dispose).toHaveBeenCalledTimes(1);
    });

    it('consumes the signal once: a second load does not re-read', () => {
      SavedIssueSignal.record(ISSUE_ID, buildIssue({ link: buildLink() }));
      buildSavedRereadEffect(reread, ISSUE_ID, taken)();

      const secondPage = { current: undefined };

      buildSavedRereadEffect(reread, ISSUE_ID, secondPage)();

      expect(reread.start).toHaveBeenCalledTimes(1);
    });

    it('keeps the taken issue when the effect runs twice (strict mode)', () => {
      SavedIssueSignal.record(ISSUE_ID, buildIssue({ link: buildLink() }));

      buildSavedRereadEffect(reread, ISSUE_ID, taken)()();
      buildSavedRereadEffect(reread, ISSUE_ID, taken)();

      expect(reread.start).toHaveBeenCalledTimes(2);
    });

    it('starts nothing without a signal', () => {
      buildSavedRereadEffect(reread, ISSUE_ID, taken)();

      expect(reread.start).not.toHaveBeenCalled();
    });

    it('ignores a signal of another issue', () => {
      SavedIssueSignal.record('other', buildIssue({ link: buildLink() }));
      buildSavedRereadEffect(reread, ISSUE_ID, taken)();

      expect(reread.start).not.toHaveBeenCalled();
    });
  });
});
