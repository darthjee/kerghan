import GithubLink from '../../link/GithubLink.jsx';
import LinkStateBadge from '../../link/LinkStateBadge.jsx';

/**
 * Render the state badge of a link that is not plainly in sync.
 *
 * @param {{state: string}} link - The issue's link.
 * @returns {React.ReactElement|null} The badge, or `null` for the `linked` state.
 */
function renderBadge(link) {
  if (link.state === 'linked') {
    return null;
  }

  return <span className="ms-2"><LinkStateBadge state={link.state} /></span>;
}

/**
 * Render the muted "stale" marker of a link whose data may be out of date.
 *
 * @param {{stale: boolean}} link - The issue's link.
 * @returns {React.ReactElement|null} The marker, or `null` unless `stale` is true.
 */
function renderStale(link) {
  if (link.stale !== true) {
    return null;
  }

  return <span className="text-muted ms-2">stale</span>;
}

/**
 * Rendering helper of the issue list's GitHub link column.
 */
const IssueLinkCellHelper = {
  /**
   * Render the cell: a dash for an unlinked issue, otherwise the `#N` link, the state badge
   * (when not `linked`) and a muted "stale" marker.
   *
   * @param {({number: number, url: string, state: string, stale: boolean}|null)} link - The
   *   issue's GitHub link, `null` when not linked.
   * @returns {React.ReactElement} The cell content.
   */
  render(link) {
    if (link === null || link === undefined) {
      return <span className="text-muted">—</span>;
    }

    return (
      <>
        <GithubLink number={link.number} url={link.url} />
        {renderBadge(link)}
        {renderStale(link)}
      </>
    );
  },
};

export default IssueLinkCellHelper;
