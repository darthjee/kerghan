import DirtyFormPrompt from '../../../../common/forms/DirtyFormPrompt.jsx';
import ProjectLoadViewHelper from '../common/ProjectLoadViewHelper.jsx';
import ProjectDangerZone from './ProjectDangerZone.jsx';
import ProjectDetailsSection from './ProjectDetailsSection.jsx';
import ProjectRepositorySection from './ProjectRepositorySection.jsx';

/**
 * Rendering helper of the project management page: the three independent sections (details,
 * repository, danger zone) once the project is loaded.
 */
const ProjectEditHelper = {
  /**
   * Render the page for the current load state.
   *
   * @param {{project: (object|null), loadState: object, guard: object}} state - Page state,
   *   with the dirty-form guard.
   * @param {{onRetry: Function, onProjectChange: Function, onNotFound: Function,
   *   onDirtyChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The loading message, the "Project not found" view, the load
   *   error with Retry, or the three sections.
   */
  render(state, handlers) {
    return ProjectLoadViewHelper.render(state, handlers.onRetry, (project) => (
      <div className="container mt-4">
        <h1 className="h2 mb-4">Edit project</h1>
        <ProjectDetailsSection
          project={project}
          guard={state.guard}
          onDirtyChange={handlers.onDirtyChange}
          onNotFound={handlers.onNotFound}
        />
        <ProjectRepositorySection
          project={project}
          onProjectChange={handlers.onProjectChange}
          onNotFound={handlers.onNotFound}
        />
        <ProjectDangerZone project={project} guard={state.guard} />
        <DirtyFormPrompt guard={state.guard} />
      </div>
    ));
  },
};

export default ProjectEditHelper;
