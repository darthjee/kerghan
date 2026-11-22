import IssueLinkPanelSlotHelper from '../../../../../../../../assets/js/components/resources/issues/pages/show/IssueLinkPanelSlotHelper.jsx';
import { buildIssue, buildProject } from '../../../../../../../support/issuesBuilders.js';

describe('IssueLinkPanelSlotHelper', () => {
  it('renders nothing until the link panel (#562) takes its place', () => {
    expect(IssueLinkPanelSlotHelper.render(buildProject(), buildIssue())).toBeNull();
  });
});
