/**
 * The Open/Closed badge of an issue, shared by the issue list and the issue page.
 *
 * @param {{state: string}} props - The issue's state (`open` or `closed`).
 * @returns {React.ReactElement} The badge.
 */
export default function IssueStateBadge({ state }) {
  const closed = state === 'closed';

  return <span className={`badge text-bg-${closed ? 'secondary' : 'success'}`}>{closed ? 'Closed' : 'Open'}</span>;
}
