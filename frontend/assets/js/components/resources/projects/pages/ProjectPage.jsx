import { useEffect, useMemo, useState } from 'react';
import Router from '../../../../utils/routing/Router.js';
import currentHash from '../../../../utils/routing/currentHash.js';
import ProjectLoadController from './common/ProjectLoadController.js';
import ProjectPageHelper from './show/ProjectPageHelper.jsx';

const INITIAL_LOAD_STATE = { loading: true, error: null, notFound: false };

/**
 * Build the mount-time effect: loads the project and returns a cleanup ignoring any answer
 * still in flight on unmount.
 *
 * @param {ProjectLoadController} controller - The page's controller.
 * @param {string} projectId - The id taken from the hash.
 * @returns {Function} Effect callback, returning its cleanup.
 */
export function buildLoadEffect(controller, projectId) {
  return () => {
    controller.load(projectId);
    return () => controller.dispose();
  };
}

/**
 * Project page (`#/projects/:projectId`): the project's header (name, description,
 * repository, "Edit"), with the issue list to be mounted below it by #561. A missing, deleted
 * or foreign project, or a malformed id, shows "Project not found" (U1, S3).
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function ProjectPage() {
  const projectId = useMemo(
    () => Router.extractParams('/projects/:projectId', currentHash()).projectId,
    [],
  );
  const [project, setProject] = useState(null);
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);

  const controller = useMemo(() => new ProjectLoadController({ setProject, setLoadState }), []);

  useEffect(() => buildLoadEffect(controller, projectId)(), [controller, projectId]);

  return ProjectPageHelper.render({ project, loadState }, { onRetry: () => controller.retry() });
}
