import Table from 'react-bootstrap/cjs/Table.js';
import IssueStateBadge from '../../IssueStateBadge.jsx';
import ProjectPaths from '../../../projects/paths.js';
import IssueLinkCellHelper from './IssueLinkCellHelper.jsx';

const TITLE_STYLE = { overflowWrap: 'anywhere', maxWidth: '32rem' };

/**
 * Render one issue row: the title as a link to the issue, its state, creation date and GitHub
 * link.
 *
 * @description The title is one truncated line with the full text in `title` (U8), rendered as
 * React text (S1).
 * @param {string} projectId - The project's uuid.
 * @param {{id: string, title: string, state: string, createdAt: string, link: (object|null)}}
 *   issue - The issue.
 * @param {{selected: Array<string>, onToggle: Function}} selection - The checked ids and the
 *   handler toggling one.
 * @returns {React.ReactElement} The table row.
 */
function renderRow(projectId, issue, selection) {
  return (
    <tr key={issue.id}>
      <td>
        <input
          type="checkbox"
          className="form-check-input"
          aria-label={`Select ${issue.title}`}
          checked={selection.selected.includes(issue.id)}
          onChange={() => selection.onToggle(issue.id)}
        />
      </td>
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
      <td><IssueStateBadge state={issue.state} /></td>
      <td>{new Date(issue.createdAt).toLocaleDateString()}</td>
      <td>{IssueLinkCellHelper.render(issue.link)}</td>
    </tr>
  );
}

/**
 * Render the header's "select all on this page" checkbox: checked when every row is selected,
 * indeterminate when only some are.
 *
 * @param {Array<object>} issues - The page's issues.
 * @param {{selected: Array<string>, onToggleAll: Function}} selection - The checked ids and the
 *   handler toggling the whole page.
 * @returns {React.ReactElement} The checkbox.
 */
function renderSelectAll(issues, selection) {
  const count = issues.filter((issue) => selection.selected.includes(issue.id)).length;
  const all = issues.length > 0 && count === issues.length;

  return (
    <input
      type="checkbox"
      className="form-check-input"
      aria-label="Select all issues on this page"
      checked={all}
      ref={(element) => {
        if (element) {
          element.indeterminate = count > 0 && !all;
        }
      }}
      onChange={() => selection.onToggleAll(issues.map((issue) => issue.id))}
    />
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
   * @param {{selected: Array<string>, onToggle: Function, onToggleAll: Function}} selection -
   *   The checked issue ids and the handlers toggling one issue or the whole page.
   * @returns {React.ReactElement} The table, with the selection checkbox, Title, State,
   *   Created and GitHub columns.
   */
  render(projectId, issues, selection) {
    return (
      <Table striped hover responsive>
        <thead>
          <tr>
            <th>{renderSelectAll(issues, selection)}</th>
            <th>Title</th>
            <th>State</th>
            <th>Created</th>
            <th>GitHub</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => renderRow(projectId, issue, selection))}
        </tbody>
      </Table>
    );
  },
};

export default IssuesTableHelper;
