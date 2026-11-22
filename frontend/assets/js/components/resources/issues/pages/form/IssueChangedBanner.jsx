/**
 * The U10 banner of the edit form: the issue changed (a sync pull or another tab) since the form
 * loaded it.
 *
 * @description Renders nothing until the focus re-read found a later `updatedAt`. Save stays
 * allowed (edit is last-write-wins); the action drops the typed values for the fresh ones.
 * @param {{visible: boolean, onDiscard: Function}} props - Whether the banner shows, and the
 *   callback of "Discard my changes and reload".
 * @returns {React.ReactElement|null} The banner, or `null` while the issue is unchanged.
 */
export default function IssueChangedBanner({ visible, onDiscard }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2" role="alert">
      <span className="me-auto">This issue changed since you opened it</span>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onDiscard}>
        Discard my changes and reload
      </button>
    </div>
  );
}
