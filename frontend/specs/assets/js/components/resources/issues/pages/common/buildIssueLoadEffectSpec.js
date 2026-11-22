import buildIssueLoadEffect from '../../../../../../../../assets/js/components/resources/issues/pages/common/buildIssueLoadEffect.js';
import { ISSUE_ID, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('buildIssueLoadEffect', () => {
  it('loads the project and issue on mount and ignores late answers after cleanup', () => {
    const controller = jasmine.createSpyObj('controller', ['load', 'dispose']);

    const cleanup = buildIssueLoadEffect(controller, PROJECT_ID, ISSUE_ID)();

    expect(controller.load).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID);
    cleanup();
    expect(controller.dispose).toHaveBeenCalledTimes(1);
  });
});
