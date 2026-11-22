import Table from 'react-bootstrap/cjs/Table.js';
import ProjectPaths from '../../../projects/paths.js';
import IssueLinkCellHelper from './IssueLinkCellHelper.jsx';

const TITLE_STYLE = { overflowWrap: 'anywhere', maxWidth: '32rem' };

/**
 * Render the Open/Closed badge.
 *
 * @param {string} state - The issue's state.
 * @returns {React.ReactElement} The badge.
 */
function renderStateBadge(state) {
  const closed = state === 'closed';

  return <span className={`badge text-bg-${closed ? 'secondary' : 'success'}`}>{closed ? 'Closed' : 'Open'}</span>;
}

/**
 * Render one issue row: the title as a link to the issue, its state, creation date and GitHub
 * link.
 *
 * @description The title is one truncated line with the full text in `title` (U8), rendered as
 * React text (S1).
 * @param {string} projectId - The project's uuid.
 * @param {{id: string, title: string, state: string, createdAt: string, link: (object|null)}}
 *   issue - The issue.
 * @returns {React.ReactElement} The table row.
 */
function renderRow(projectId, issue) {
  return (
    <tr key={issue.id}>
      <td>
        <a
          href={ProjectPaths.issue(projectId, issue.id)}
          className="d-inline-block text-truncate align-bottom"
          style={TITLE_STYLE}
          title={issue.title}
        >
          {issue.title}
        </a>
      </td>
      <td>{renderStateBadge(issue.state)}</td>
      <td>{new Date(issue.createdAt).toLocaleDateString()}</td>
      <td>{IssueLinkCellHelper.render(issue.link)}</td>
    </tr>
  );
}

/**
 * Rendering helper for the issue list's table.
 */
const IssuesTableHelper = {
  /**
   * Render the table.
   *
   * @param {string} projectId - The project's uuid.
   * @param {Array<object>} issues - The page's issues.
   * @returns {React.ReactElement} The table, with the Title, State, Created and GitHub columns.
   */
  render(projectId, issues) {
    return (
      <Table striped hover responsive>
        <thead>
          <tr>
            <th>Title</th>
            <th>State</th>
            <th>Created</th>
            <th>GitHub</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => renderRow(projectId, issue))}
        </tbody>
      </Table>
    );
  },
};

export default IssuesTableHelper;
