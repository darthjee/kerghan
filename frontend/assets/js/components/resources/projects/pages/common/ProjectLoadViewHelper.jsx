import ProjectPaths from '../../paths.js';
import LoadErrorHelper from './LoadErrorHelper.jsx';
import NotFoundHelper from './NotFoundHelper.jsx';

/**
 * Rendering helper of the load states shared by the pages of one project: loading, "Project
 * not found" (U1), the load error with Retry, and the loaded content.
 */
const ProjectLoadViewHelper = {
  /**
   * Render the view for the current load state.
   *
   * @param {{project: (object|null), loadState: {loading: boolean, error: (string|null),
   *   notFound: boolean}}} state - Page state.
   * @param {Function} onRetry - Click handler of the load error's Retry.
   * @param {Function} renderLoaded - Called with the project to render the loaded content.
   * @returns {React.ReactElement} The "Project not found" view, the load error, the loading
   *   message, or the loaded content.
   */
  render(state, onRetry, renderLoaded) {
    const { project, loadState } = state;

    if (loadState.notFound) {
      return NotFoundHelper.render('Project not found', { href: ProjectPaths.list, text: 'Back to projects' });
    }

    if (loadState.error) {
      return LoadErrorHelper.render(loadState.error, onRetry);
    }

    if (loadState.loading || project === null) {
      return <div className="container mt-4"><p>Loading project…</p></div>;
    }

    return renderLoaded(project);
  },
};

export default ProjectLoadViewHelper;
