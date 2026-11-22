const STATUS_BADGES = new Map([
  ['added', { label: 'Added', className: 'text-bg-success' }],
  ['not_added', { label: 'Not added', className: 'text-bg-warning' }],
  ['unavailable', { label: 'Unavailable', className: 'text-bg-danger' }],
  ['unknown', { label: 'Unknown', className: 'text-bg-secondary' }],
]);

const FALLBACK_BADGE = STATUS_BADGES.get('unknown');

/**
 * A project's repository, as `owner/name` with its status badge, or "No repository".
 *
 * @description The name and badge are rendered as React text (S1). A repository the API could
 * not resolve (no name) shows as "Unknown repository" next to its badge.
 * @param {{repository: ({fullName: (string|null), status: string}|null)}} props - The project's
 *   `repository` object, or `null` for a project without one.
 * @returns {React.ReactElement} The label.
 */
export default function RepositoryLabel({ repository }) {
  if (repository === null) {
    return <span className="text-muted">No repository</span>;
  }

  const badge = STATUS_BADGES.get(repository.status) ?? FALLBACK_BADGE;

  return (
    <span>
      <span style={{ overflowWrap: 'anywhere' }}>{repository.fullName ?? 'Unknown repository'}</span>
      {' '}
      <span className={`badge ${badge.className}`}>{badge.label}</span>
    </span>
  );
}
