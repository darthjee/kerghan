import ImportIssueModal from '../../../issues/link/modals/ImportIssueModal.jsx';
import IssueList from '../../../issues/list/IssueList.jsx';
import ProjectLoadViewHelper from '../common/ProjectLoadViewHelper.jsx';
import ProjectHeader from './ProjectHeader.jsx';

/**
 * Render the import modal, shown only while it is open.
 *
 * @param {boolean} importing - Whether the modal is open.
 * @param {object} project - The project.
 * @param {{onCloseImport: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The modal, or `null` while closed.
 */
function renderImport(importing, project, handlers) {
  if (!importing) {
    return null;
  }

  return <ImportIssueModal projectId={project.id} repository={project.repository} onClose={handlers.onCloseImport} />;
}

/**
 * Rendering helper of the project page: composes the project header and, below it, the
 * project's issue list, plus the import modal both "Import from GitHub" entries open.
 */
const ProjectPageHelper = {
  /**
   * Render the page for the current load state.
   *
   * @param {{project: (object|null), loadState: {loading: boolean, error: (string|null),
   *   notFound: boolean}, importing: boolean, listRef: object}} state - Page state: the
   *   project, the load state, whether the import modal is open, and the ref receiving the
   *   list's controller.
   * @param {{onRetry: Function, onImport: Function, onCloseImport: Function,
   *   onReloadList: Function, onReloadProject: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The loading message, the "Project not found" view, the load
   *   error with Retry, or the header with the issue list below it.
   */
  render(state, handlers) {
    return ProjectLoadViewHelper.render(state, handlers.onRetry, (project) => (
      <div className="container mt-4">
        <ProjectHeader
          project={project}
          onImport={handlers.onImport}
          onReloadList={handlers.onReloadList}
          onReloadProject={handlers.onReloadProject}
        />
        <IssueList
          projectId={project.id}
          canImport={project.repository !== null}
          onImport={handlers.onImport}
          listRef={state.listRef}
        />
        {renderImport(state.importing, project, handlers)}
      </div>
    ));
  },
};

export default ProjectPageHelper;
