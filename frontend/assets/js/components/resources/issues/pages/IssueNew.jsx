import { useCallback, useEffect, useMemo, useState } from 'react';
import Router from '../../../../utils/routing/Router.js';
import currentHash from '../../../../utils/routing/currentHash.js';
import ProjectLoadController from '../../projects/pages/common/ProjectLoadController.js';
import ProjectLoadViewHelper from '../../projects/pages/common/ProjectLoadViewHelper.jsx';
import buildLoadEffect from '../../projects/pages/common/buildLoadEffect.js';
import IssueFormSection from './form/IssueFormSection.jsx';

const INITIAL_LOAD_STATE = { loading: true, error: null, notFound: false };
const NOT_FOUND_STATE = { loading: false, error: null, notFound: true };

/**
 * Issue creation form (`#/projects/:projectId/issues/new`): Title and Body (Write and
 * Preview). A missing, deleted or foreign project, or a malformed id, shows "Project not
 * found" (U1, S3). Unsaved changes are guarded (U11).
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function IssueNew() {
  const projectId = useMemo(
    () => Router.extractParams('/projects/:projectId/issues/new', currentHash()).projectId,
    [],
  );
  const [project, setProject] = useState(null);
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);

  const controller = useMemo(() => new ProjectLoadController({ setProject, setLoadState }), []);
  const onNotFound = useCallback(() => setLoadState(NOT_FOUND_STATE), []);

  useEffect(() => buildLoadEffect(controller, projectId)(), [controller, projectId]);

  return ProjectLoadViewHelper.render(
    { project, loadState },
    () => controller.retry(),
    (loaded) => <IssueFormSection project={loaded} issue={null} onNotFound={onNotFound} />,
  );
}
