import LoadErrorHelper from '../common/LoadErrorHelper.jsx';
import NotFoundHelper from '../common/NotFoundHelper.jsx';
import ProjectPaths from '../../paths.js';
import ProjectHeaderHelper from './ProjectHeaderHelper.jsx';

/**
 * Rendering helper of the project page: composes the project header, and leaves the issue
 * list (#561) its place below it.
 */
const ProjectPageHelper = {
  /**
   * Render the page for the current load state.
   *
   * @param {{project: (object|null), loadState: {loading: boolean, error: (string|null),
   *   notFound: boolean}}} state - Page state.
   * @param {{onRetry: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The loading message, the "Project not found" view, the load
   *   error with Retry, or the header.
   */
  render(state, handlers) {
    const { project, loadState } = state;

    if (loadState.notFound) {
      return NotFoundHelper.render('Project not found', { href: ProjectPaths.list, text: 'Back to projects' });
    }

    if (loadState.error) {
      return LoadErrorHelper.render(loadState.error, handlers.onRetry);
    }

    if (loadState.loading || project === null) {
      return <div className="container mt-4"><p>Loading project…</p></div>;
    }

    return (
      <div className="container mt-4">
        {ProjectHeaderHelper.render(project)}
      </div>
    );
  },
};

export default ProjectPageHelper;
