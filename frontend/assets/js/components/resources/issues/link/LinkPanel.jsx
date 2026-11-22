import { useEffect, useMemo, useState } from 'react';
import useRateLimitCountdown from '../../../common/forms/hooks/useRateLimitCountdown.js';
import LinkPanelController from './LinkPanelController.js';
import LinkPanelHelper from './LinkPanelHelper.jsx';
import LinkStatePresenter from './linkStatePresenter.js';
import useLinkClock from './useLinkClock.js';

/**
 * The GitHub link panel of the issue page: the link's state and message, its actions (Refresh,
 * Retry sync, Unlink), and the entry to attach the issue to a GitHub issue.
 *
 * @description The state table, the actions and the "last synced" times come from
 * `LinkStatePresenter`; the actions run through `LinkPanelController`, which stops any re-read
 * when the panel unmounts. A rate-limited Refresh or Retry sync shows the shared countdown on
 * its button.
 * @param {{projectId: string, project: object, issue: object, onIssueChange: Function,
 *   onNotFound: Function}} props - The project's uuid, the project (its repository decides
 *   whether linking is offered), the issue shown, the setter of the issue and the callback for
 *   an issue that vanished (`404`).
 * @returns {React.ReactElement} The rendered panel.
 */
export default function LinkPanel({
  projectId, project, issue, onIssueChange, onNotFound,
}) {
  const [activity, setActivity] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const now = useLinkClock();
  const countdown = useRateLimitCountdown(error?.retryAfterSeconds);

  const controller = useMemo(() => new LinkPanelController({
    setIssue: onIssueChange, setActivity, setNotice, setError, setConfirming, onNotFound,
  }), [onIssueChange, onNotFound]);

  useEffect(() => () => controller.dispose(), [controller]);

  return LinkPanelHelper.render(
    {
      view: LinkStatePresenter.present(issue.link, project.repository, now),
      activity, notice, error, confirming, attaching, countdown,
    },
    {
      onRefresh: () => controller.refresh(projectId, issue.id),
      onRetrySync: () => controller.retrySync(projectId, issue.id),
      onUnlink: () => controller.unlink(projectId, issue),
      onConfirmDiscard: () => controller.confirmDiscard(projectId, issue),
      onCancelDiscard: () => controller.cancelDiscard(),
      onAttach: () => setAttaching(true),
      onCloseAttach: () => setAttaching(false),
    },
  );
}
