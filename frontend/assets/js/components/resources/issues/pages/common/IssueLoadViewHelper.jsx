import ProjectPaths from '../../../projects/paths.js';
import LoadErrorHelper from '../../../projects/pages/common/LoadErrorHelper.jsx';
import NotFoundHelper from '../../../projects/pages/common/NotFoundHelper.jsx';

/**
 * Rendering helper of the load states shared by the pages of one issue: "Project not found" and
 * "Issue not found" (U1), the load error with Retry, "Loading issue…", and the loaded content.
 */
const IssueLoadViewHelper = {
  /**
   * Render the view for the current load state.
   *
   * @param {{projectId: string, project: (object|null), issue: (object|null),
   *   loadState: {loading: boolean, error: (string|null), notFound: (string|null)}}} state -
   *   Page state.
   * @param {Function} onRetry - Click handler of the load error's Retry.
   * @param {Function} renderLoaded - Called with the project and the issue to render the loaded
   *   content.
   * @returns {React.ReactElement} The "not found" view, the load error, the loading message,
   *   or the loaded content.
   */
  render(state, onRetry, renderLoaded) {
    const {
      projectId, project, issue, loadState,
    } = state;

    if (loadState.notFound === 'project') {
      return NotFoundHelper.render('Project not found', { href: ProjectPaths.list, text: 'Back to projects' });
    }

    if (loadState.notFound === 'issue') {
      return NotFoundHelper.render('Issue not found', { href: ProjectPaths.show(projectId), text: 'Back to the project' });
    }

    if (loadState.error) {
      return LoadErrorHelper.render(loadState.error, onRetry);
    }

    if (loadState.loading || project === null || issue === null) {
      return <div className="container mt-4"><p>Loading issue…</p></div>;
    }

    return renderLoaded(project, issue);
  },
};

export default IssueLoadViewHelper;
