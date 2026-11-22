import { useEffect, useMemo, useState } from 'react';
import useRateLimitCountdown from '../../../../common/forms/hooks/useRateLimitCountdown.js';
import IssueActionsController from './IssueActionsController.js';
import IssueActionsHelper from './IssueActionsHelper.jsx';

/**
 * Actions of the issue page: Edit, Close or Reopen, and Delete (behind a confirmation, and
 * disabled while the issue is linked).
 *
 * @description A rate-limited Close or Reopen (`ISSUE_EDIT_RATE_LIMITED`) shows the shared
 * countdown on its button; the button is enabled again at 0 and nothing is resent.
 * @param {{projectId: string, issue: object, onIssueChange: Function, onNotFound: Function}}
 *   props - The project's uuid, the issue shown, the setter of the issue (Close and Reopen show
 *   the returned one) and the callback for an issue that vanished (`404`).
 * @returns {React.ReactElement} The rendered actions.
 */
export default function IssueActions({
  projectId, issue, onIssueChange, onNotFound,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const countdown = useRateLimitCountdown(error?.retryAfterSeconds);

  const controller = useMemo(
    () => new IssueActionsController({
      setIssue: onIssueChange, setBusy, setError, onNotFound,
    }),
    [onIssueChange, onNotFound],
  );

  useEffect(() => () => controller.dispose(), [controller]);

  return IssueActionsHelper.render(
    {
      projectId, issue, busy, error, confirming, countdown,
    },
    {
      onToggle: () => controller.toggleState(projectId, issue),
      onOpenDelete: () => setConfirming(true),
      onDelete: () => controller.remove(projectId, issue.id),
      onCancel: () => setConfirming(false),
    },
  );
}
