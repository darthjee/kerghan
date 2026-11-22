import ProjectLoadViewHelper from '../common/ProjectLoadViewHelper.jsx';
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
    return ProjectLoadViewHelper.render(state, handlers.onRetry, (project) => (
      <div className="container mt-4">
        {ProjectHeaderHelper.render(project)}
      </div>
    ));
  },
};

export default ProjectPageHelper;
