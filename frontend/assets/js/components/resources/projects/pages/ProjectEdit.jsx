import { useCallback, useEffect, useMemo, useState } from 'react';
import useDirtyFormGuard from '../../../common/forms/hooks/useDirtyFormGuard.js';
import Router from '../../../../utils/routing/Router.js';
import currentHash from '../../../../utils/routing/currentHash.js';
import ProjectLoadController from './common/ProjectLoadController.js';
import buildLoadEffect from './common/buildLoadEffect.js';
import ProjectEditHelper from './edit/ProjectEditHelper.jsx';

const INITIAL_LOAD_STATE = { loading: true, error: null, notFound: false };
const NOT_FOUND_STATE = { loading: false, error: null, notFound: true };

/**
 * Project management page (`#/projects/:projectId/edit`): three independent sections, the
 * name and description (Save, Cancel), the repository (connect, change, detach, acting at
 * once) and the danger zone (delete). A missing, deleted or foreign project, or a malformed id,
 * shows "Project not found" (U1, S3). Unsaved details are guarded (U11).
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function ProjectEdit() {
  const projectId = useMemo(
    () => Router.extractParams('/projects/:projectId/edit', currentHash()).projectId,
    [],
  );
  const [project, setProject] = useState(null);
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);
  const [dirty, setDirty] = useState(false);

  const controller = useMemo(() => new ProjectLoadController({ setProject, setLoadState }), []);
  const guard = useDirtyFormGuard(dirty);
  const onNotFound = useCallback(() => setLoadState(NOT_FOUND_STATE), []);

  useEffect(() => buildLoadEffect(controller, projectId)(), [controller, projectId]);

  return ProjectEditHelper.render(
    { project, loadState, guard },
    {
      onRetry: () => controller.retry(),
      onProjectChange: setProject,
      onNotFound,
      onDirtyChange: setDirty,
    },
  );
}
