import LinkPanel from '../../../../../../../../assets/js/components/resources/issues/link/LinkPanel.jsx';
import IssueLinkPanelSlotHelper from '../../../../../../../../assets/js/components/resources/issues/pages/show/IssueLinkPanelSlotHelper.jsx';
import { buildIssue, buildProject, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('IssueLinkPanelSlotHelper', () => {
  it('renders the link panel of the issue', () => {
    const project = buildProject();
    const issue = buildIssue();
    const handlers = { onIssueChange: () => undefined, onNotFound: () => undefined };
    const element = IssueLinkPanelSlotHelper.render(project, issue, handlers);

    expect(element.type).toBe(LinkPanel);
    expect(element.props).toEqual({
      projectId: PROJECT_ID, project, issue, onIssueChange: handlers.onIssueChange, onNotFound: handlers.onNotFound,
    });
  });
});
