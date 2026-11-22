import LinkPanel from '../../link/LinkPanel.jsx';

/**
 * The slot between the issue page's header and its body, where the GitHub link panel sits.
 */
const IssueLinkPanelSlotHelper = {
  /**
   * Render the slot.
   *
   * @param {{id: string, repository: (object|null)}} project - The project of the issue.
   * @param {object} issue - The issue shown.
   * @param {{onIssueChange: Function, onNotFound: Function}} handlers - The setter of the issue
   *   and the callback for an issue that vanished (`404`).
   * @returns {React.ReactElement} The link panel.
   */
  render(project, issue, handlers) {
    return (
      <LinkPanel
        projectId={project.id}
        project={project}
        issue={issue}
        onIssueChange={handlers.onIssueChange}
        onNotFound={handlers.onNotFound}
      />
    );
  },
};

export default IssueLinkPanelSlotHelper;
