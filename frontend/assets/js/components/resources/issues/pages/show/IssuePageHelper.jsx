import IssueBody from '../../body/IssueBody.jsx';
import IssueLoadViewHelper from '../common/IssueLoadViewHelper.jsx';
import IssueActions from './IssueActions.jsx';
import IssueHeaderHelper from './IssueHeaderHelper.jsx';
import IssueLinkPanelSlotHelper from './IssueLinkPanelSlotHelper.jsx';

/**
 * Rendering helper of the issue page: composes the header, the (empty) link-panel slot, the
 * body and the actions.
 */
const IssuePageHelper = {
  /**
   * Render the page for the current load state.
   *
   * @param {{projectId: string, project: (object|null), issue: (object|null), loadState:
   *   {loading: boolean, error: (string|null), notFound: (string|null)}}} state - Page state.
   * @param {{onRetry: Function, onIssueChange: Function, onNotFound: Function}} handlers -
   *   Event handlers.
   * @returns {React.ReactElement} The "not found" view, the load error with Retry, the loading
   *   message, or the issue.
   */
  render(state, handlers) {
    return IssueLoadViewHelper.render(state, handlers.onRetry, (project, issue) => (
      <div className="container mt-4">
        {IssueHeaderHelper.render(project, issue)}
        {IssueLinkPanelSlotHelper.render(project, issue)}
        <IssueBody body={issue.body} />
        <IssueActions
          projectId={project.id}
          issue={issue}
          onIssueChange={handlers.onIssueChange}
          onNotFound={handlers.onNotFound}
        />
      </div>
    ));
  },
};

export default IssuePageHelper;
