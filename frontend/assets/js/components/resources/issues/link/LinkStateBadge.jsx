/**
 * Badge wording and Bootstrap variant of each primary link state, from the Link and sync
 * states table of the UI spec.
 *
 * @type {Map<string, {label: string, variant: string}>}
 */
const BADGES = new Map([
  ['linked', { label: 'Synced', variant: 'success' }],
  ['pending', { label: 'Pending', variant: 'info' }],
  ['rate_limited', { label: 'Rate limited', variant: 'warning' }],
  ['repository_unavailable', { label: 'Repository unavailable', variant: 'secondary' }],
  ['sync_failed', { label: 'Sync failed', variant: 'danger' }],
  ['gone', { label: 'GitHub issue gone', variant: 'dark' }],
]);

/**
 * Badge of a link's primary state; shared by the issue list and the link panel.
 *
 * @description Renders nothing for a state it does not know.
 * @param {{state: string}} props - The link's primary state (`linked`, `pending`,
 *   `rate_limited`, `repository_unavailable`, `sync_failed` or `gone`).
 * @returns {React.ReactElement|null} The badge, or `null` for an unknown state.
 */
export default function LinkStateBadge({ state }) {
  const badge = BADGES.get(state);

  if (badge === undefined) {
    return null;
  }

  return <span className={`badge text-bg-${badge.variant}`}>{badge.label}</span>;
}
