/**
 * Build the mount-time effect: loads the project and returns a cleanup ignoring any answer
 * still in flight on unmount.
 *
 * @param {{load: Function, dispose: Function}} controller - The page's controller.
 * @param {string} projectId - The id taken from the hash.
 * @returns {Function} Effect callback, returning its cleanup.
 */
export default function buildLoadEffect(controller, projectId) {
  return () => {
    controller.load(projectId);
    return () => controller.dispose();
  };
}
