import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Router from '../../../../utils/routing/Router.js';
import currentHash from '../../../../utils/routing/currentHash.js';
import ProjectLoadController from './common/ProjectLoadController.js';
import buildLoadEffect from './common/buildLoadEffect.js';
import useFocusReread from '../../issues/sync/useFocusReread.js';
import ProjectPageHelper from './show/ProjectPageHelper.jsx';

const INITIAL_LOAD_STATE = { loading: true, error: null, notFound: false };

/**
 * Project page (`#/projects/:projectId`): the project's header (name, description,
 * repository and its hint, "Import from GitHub", "Refresh project", "New issue", "Edit"), with
 * the project's issue list below it. It re-reads the project and the current list page when the
 * window regains focus (at most every 30 s). A missing, deleted or foreign project, or a
 * malformed id, shows "Project not found" (U1, S3).
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

  const [importing, setImporting] = useState(false);
  const listRef = useRef(null);

  const controller = useMemo(() => new ProjectLoadController({ setProject, setLoadState }), []);
  const onReloadList = useCallback(() => listRef.current?.load(), []);
  const onReloadProject = useCallback(() => controller.reread(), [controller]);
  const onFocusReread = useCallback(() => {
    controller.reread();
    listRef.current?.load();
  }, [controller]);
  const onImport = useCallback(() => setImporting(true), []);
  const onCloseImport = useCallback(() => setImporting(false), []);

  useEffect(() => buildLoadEffect(controller, projectId)(), [controller, projectId]);
  useFocusReread(onFocusReread);

  return ProjectPageHelper.render(
    {
      project, loadState, importing, listRef,
    },
    {
      onRetry: () => controller.retry(), onImport, onCloseImport, onReloadList, onReloadProject,
    },
  );
}
