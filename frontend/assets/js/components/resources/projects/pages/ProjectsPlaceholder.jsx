import { isUuid } from '../../../../utils/ids/uuid.js';
import currentHash from '../../../../utils/routing/currentHash.js';

/**
 * Find the project the current hash points at.
 *
 * @param {string} hash - The location hash (e.g. `#/projects/<uuid>/issues/new?x=1`).
 * @returns {(string|null)} The project's uuid, or `null` when the hash carries none (S3: an id
 *   that is not a uuid is never put in a link).
 */
function projectIdOf(hash) {
  const [, projectId] = hash.split('?')[0].replace(/^#\/?/, '').split('/');

  return isUuid(projectId) ? projectId : null;
}

/**
 * Placeholder of the issue screens (`#/projects/:projectId/issues/new`, `…/:issueId` and
 * `…/:issueId/edit`), which #561 and #562 replace. It keeps the routes registered and
 * resolvable until then.
 *
 * @returns {React.ReactElement} A "Coming soon" page with a link back to the project (or to
 *   the project list when the hash carries no valid project id).
 */
export default function ProjectsPlaceholder() {
  const projectId = projectIdOf(currentHash());
  const href = projectId === null ? '#/projects' : `#/projects/${encodeURIComponent(projectId)}`;

  return (
    <div className="container py-4">
      <h1 className="h3">Coming soon</h1>
      <p>The issue screens are not available yet.</p>
      <a href={href}>{projectId === null ? 'Back to projects' : 'Back to the project'}</a>
    </div>
  );
}
