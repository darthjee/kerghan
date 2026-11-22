import { useCallback, useEffect, useMemo, useState } from 'react';
import Router from '../../../../utils/routing/Router.js';
import currentHash from '../../../../utils/routing/currentHash.js';
import IssueLoadController from './common/IssueLoadController.js';
import buildIssueLoadEffect from './common/buildIssueLoadEffect.js';
import useFocusReread from '../sync/useFocusReread.js';
import IssuePageHelper from './show/IssuePageHelper.jsx';
import useSavedIssueReread from './show/useSavedIssueReread.js';

const INITIAL_LOAD_STATE = { loading: true, error: null, notFound: null };

/**
 * Issue page (`#/projects/:projectId/issues/:issueId`): the issue's header, GitHub link panel,
 * body and actions. It re-reads quietly when the window regains focus (at most every 30 s), and
 * runs the bounded re-read after the edit form saved the issue.
 * A missing, deleted or foreign project or issue, or a malformed id, shows "Project not found"
 * or "Issue not found" (U1, S3).
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function IssuePage() {
  const { projectId, issueId } = useMemo(
    () => Router.extractParams('/projects/:projectId/issues/:issueId', currentHash()),
    [],
  );
  const [project, setProject] = useState(null);
  const [issue, setIssue] = useState(null);
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);

  const controller = useMemo(() => new IssueLoadController({ setProject, setIssue, setLoadState }), []);
  const onNotFound = useCallback(() => setLoadState({ loading: false, error: null, notFound: 'issue' }), []);

  const onFocusReread = useCallback(() => controller.reread(), [controller]);

  useEffect(() => buildIssueLoadEffect(controller, projectId, issueId)(), [controller, projectId, issueId]);
  useFocusReread(onFocusReread);
  useSavedIssueReread(projectId, issueId, { onIssueChange: setIssue, onNotFound });

  return IssuePageHelper.render(
    {
      projectId, project, issue, loadState,
    },
    { onRetry: () => controller.retry(), onIssueChange: setIssue, onNotFound },
  );
}
