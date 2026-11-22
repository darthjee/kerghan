/**
 * Build the mount-time effect: loads the project and the issue and returns a cleanup ignoring
 * any answer still in flight on unmount.
 *
 * @param {{load: Function, dispose: Function}} controller - The page's `IssueLoadController`.
 * @param {string} projectId - The project id taken from the hash.
 * @param {string} issueId - The issue id taken from the hash.
 * @returns {Function} Effect callback, returning its cleanup.
 */
export default function buildIssueLoadEffect(controller, projectId, issueId) {
  return () => {
    controller.load(projectId, issueId);
    return () => controller.dispose();
  };
}
