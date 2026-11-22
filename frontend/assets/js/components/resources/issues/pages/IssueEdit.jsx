import { useCallback, useEffect, useMemo, useState } from 'react';
import Router from '../../../../utils/routing/Router.js';
import currentHash from '../../../../utils/routing/currentHash.js';
import IssueLoadController from './common/IssueLoadController.js';
import IssueLoadViewHelper from './common/IssueLoadViewHelper.jsx';
import buildIssueLoadEffect from './common/buildIssueLoadEffect.js';
import IssueFormSection from './form/IssueFormSection.jsx';

const INITIAL_LOAD_STATE = { loading: true, error: null, notFound: null };
const NOT_FOUND_STATE = { loading: false, error: null, notFound: 'issue' };

/**
 * Issue edit form (`#/projects/:projectId/issues/:issueId/edit`): Title, Body (Write and
 * Preview) and State, with a note when the issue is linked to GitHub. A missing, deleted or
 * foreign project or issue, or a malformed id, shows the matching not-found view (U1, S3).
 * Unsaved changes are guarded (U11).
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function IssueEdit() {
  const { projectId, issueId } = useMemo(
    () => Router.extractParams('/projects/:projectId/issues/:issueId/edit', currentHash()),
    [],
  );
  const [project, setProject] = useState(null);
  const [issue, setIssue] = useState(null);
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);

  const controller = useMemo(() => new IssueLoadController({ setProject, setIssue, setLoadState }), []);
  const onNotFound = useCallback(() => setLoadState(NOT_FOUND_STATE), []);

  useEffect(() => buildIssueLoadEffect(controller, projectId, issueId)(), [controller, projectId, issueId]);

  return IssueLoadViewHelper.render(
    {
      projectId, project, issue, loadState,
    },
    () => controller.retry(),
    (loadedProject, loadedIssue) => (
      <IssueFormSection project={loadedProject} issue={loadedIssue} onNotFound={onNotFound} />
    ),
  );
}
