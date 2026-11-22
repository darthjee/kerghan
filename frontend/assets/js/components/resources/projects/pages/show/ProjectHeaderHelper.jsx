import ProjectPaths from '../../paths.js';
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
 * Rendering helper of the project page's header: name, description, repository and actions.
 */
const ProjectHeaderHelper = {
  /**
   * Render the header. The name and the description are React text (S1) and wrap anywhere (U8).
   *
   * @param {{id: string, name: string, description: (string|null), repository: (object|null)}}
   *   project - The project.
   * @returns {React.ReactElement} The header, with its "Edit" action.
   */
  render(project) {
    return (
      <header className="mb-4">
        <div className="d-flex flex-wrap align-items-start gap-2">
          <h1 className="h2 me-auto" style={{ overflowWrap: 'anywhere' }}>{project.name}</h1>
          <a className="btn btn-outline-primary" href={ProjectPaths.edit(project.id)}>Edit</a>
        </div>
        {renderDescription(project.description)}
        <div><RepositoryLabel repository={project.repository} /></div>
      </header>
    );
  },
};

export default ProjectHeaderHelper;
