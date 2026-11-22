import DescribedError from '../../DescribedError.jsx';
import ProjectPaths from '../../paths.js';
import RepositoryHint from '../../RepositoryHint.jsx';
import RepositoryLabel from '../../RepositoryLabel.jsx';

/**
 * Render the description as plain text, shown only when the project has one.
 *
 * @param {(string|null)} description - The project's description.
 * @returns {React.ReactElement|null} The text, or `null` without a description.
 */
function renderDescription(description) {
  if (description === null || description === '') {
    return null;
  }

  return <p style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{description}</p>;
}

/**
 * Render "Import from GitHub" and "Refresh project", shown only when the project has a
 * repository. Refresh is disabled while it runs or a rate limit counts down (U2).
 *
 * @param {{project: object, refreshing: boolean, countdown: {active: boolean, label: (string|null)}}}
 *   state - Header state.
 * @param {{onImport: Function, onRefresh: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The two buttons, or `null` without a repository.
 */
function renderRepositoryActions(state, handlers) {
  if (state.project.repository === null) {
    return null;
  }

  const { refreshing, countdown } = state;
  const label = countdown.active ? countdown.label : 'Refresh project';

  return (
    <>
      <button type="button" className="btn btn-outline-primary" onClick={handlers.onImport}>Import from GitHub</button>
      <button type="button" className="btn btn-outline-secondary" disabled={refreshing || countdown.active} onClick={handlers.onRefresh}>
        {refreshing ? 'Refreshing…' : label}
      </button>
    </>
  );
}

/**
 * Render the refresh notice, shown only while there is one.
 *
 * @param {(string|null)} notice - The notice text.
 * @returns {React.ReactElement|null} The notice, or `null`.
 */
function renderNotice(notice) {
  return notice === null ? null : <div className="alert alert-info py-1 mt-2 mb-0" role="status">{notice}</div>;
}

/**
 * Render the refresh error, shown only while there is one.
 *
 * @param {(object|null)} error - The described error.
 * @returns {React.ReactElement|null} The error, or `null`.
 */
function renderError(error) {
  return error === null ? null : <DescribedError error={error} className="alert alert-danger py-1 mt-2 mb-0" role="alert" />;
}

/**
 * Rendering helper of the project page's header: name, description, repository and actions.
 */
const ProjectHeaderHelper = {
  /**
   * Render the header. The name and the description are React text (S1) and wrap anywhere (U8).
   *
   * @param {{project: {id: string, name: string, description: (string|null),
   *   repository: (object|null)}, refreshing: boolean, notice: (string|null),
   *   error: (object|null), countdown: {active: boolean, label: (string|null)}}} state - Header
   *   state: the project, the in-flight flag of Refresh project, its notice and described error,
   *   and the rate-limit countdown.
   * @param {{onImport: Function, onRefresh: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The header, with its "Import from GitHub" and "Refresh
   *   project" actions (only with a repository), "New issue" and "Edit", the repository hint
   *   and the refresh notice or error.
   */
  render(state, handlers) {
    const { project } = state;

    return (
      <header className="mb-4">
        <div className="d-flex flex-wrap align-items-start gap-2">
          <h1 className="h2 me-auto" style={{ overflowWrap: 'anywhere' }}>{project.name}</h1>
          {renderRepositoryActions(state, handlers)}
          <a className="btn btn-primary" href={ProjectPaths.newIssue(project.id)}>New issue</a>
          <a className="btn btn-outline-primary" href={ProjectPaths.edit(project.id)}>Edit</a>
        </div>
        {renderDescription(project.description)}
        <div><RepositoryLabel repository={project.repository} /></div>
        <RepositoryHint repository={project.repository} />
        {renderNotice(state.notice)}
        {renderError(state.error)}
      </header>
    );
  },
};

export default ProjectHeaderHelper;
