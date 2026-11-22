import IssueStateBadge from '../../IssueStateBadge.jsx';
import ProjectPaths from '../../../projects/paths.js';

/**
 * Format an ISO timestamp for display.
 *
 * @param {string} iso - The timestamp.
 * @returns {string} The local date and time.
 */
function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

/**
 * Rendering helper of the issue page's header: the way back, the title, the state and the
 * dates.
 */
const IssueHeaderHelper = {
  /**
   * Render the header. The project name and the title are React text (S1); the title wraps
   * anywhere (U8).
   *
   * @param {{id: string, name: string}} project - The issue's project.
   * @param {{title: string, state: string, createdAt: string, updatedAt: string}} issue - The
   *   issue.
   * @returns {React.ReactElement} The header.
   */
  render(project, issue) {
    return (
      <header className="mb-4">
        <p><a href={ProjectPaths.show(project.id)}>{`Back to ${project.name}`}</a></p>
        <div className="d-flex flex-wrap align-items-start gap-2">
          <h1 className="h2 me-auto" style={{ overflowWrap: 'anywhere' }}>{issue.title}</h1>
          <IssueStateBadge state={issue.state} />
        </div>
        <p className="text-muted small mb-0">
          {`Created ${formatDate(issue.createdAt)} · Updated ${formatDate(issue.updatedAt)}`}
        </p>
      </header>
    );
  },
};

export default IssueHeaderHelper;
