import Table from 'react-bootstrap/cjs/Table.js';
import RepositoryLabel from '../../../RepositoryLabel.jsx';

const NAME_STYLE = { overflowWrap: 'anywhere', maxWidth: '32rem' };

/**
 * Render one project row: the name as a link to the project, and its repository.
 *
 * @description The name is one truncated line with the full text in `title` (U8).
 * @param {{id: string, name: string, repository: (object|null)}} project - The project.
 * @returns {React.ReactElement} The table row.
 */
function renderRow(project) {
  return (
    <tr key={project.id}>
      <td>
        <a
          href={`#/projects/${encodeURIComponent(project.id)}`}
          className="d-inline-block text-truncate align-bottom"
          style={NAME_STYLE}
          title={project.name}
        >
          {project.name}
        </a>
      </td>
      <td><RepositoryLabel repository={project.repository} /></td>
    </tr>
  );
}

/**
 * Rendering helper for the project list's table.
 */
const ProjectsTableHelper = {
  /**
   * Render the table.
   *
   * @param {Array<object>} projects - The page's projects.
   * @returns {React.ReactElement} The table, with the Name and Repository columns.
   */
  render(projects) {
    return (
      <Table striped hover responsive>
        <thead>
          <tr>
            <th>Name</th>
            <th>Repository</th>
          </tr>
        </thead>
        <tbody>
          {projects.map(renderRow)}
        </tbody>
      </Table>
    );
  },
};

export default ProjectsTableHelper;
