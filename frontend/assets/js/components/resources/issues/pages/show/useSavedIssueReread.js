import { useEffect, useMemo, useRef } from 'react';
import IssuesClient from '../../../../../client/IssuesClient.js';
import BoundedRereadController from '../../sync/BoundedRereadController.js';
import SavedIssueSignal from '../../sync/savedIssueSignal.js';

/**
 * Build the effect that starts the bounded re-read after the edit form saved this issue.
 *
 * @description Takes the one-shot saved-issue signal once (kept in `taken`, so the effect
 * running twice under React's strict mode does not lose it) and starts the re-read when the
 * saved issue is linked and not `gone`. The cleanup stops it.
 * @param {{start: Function, dispose: Function}} reread - The page's `BoundedRereadController`.
 * @param {string} issueId - The issue's uuid.
 * @param {{current: (object|null|undefined)}} taken - Holder of the signal's issue once taken.
 * @returns {Function} Effect callback, returning its cleanup.
 */
export function buildSavedRereadEffect(reread, issueId, taken) {
  return () => {
    taken.current ??= SavedIssueSignal.consume(issueId) ?? null;

    if (taken.current !== null) {
      reread.start(taken.current);
    }

    return () => reread.dispose();
  };
}

/**
 * Re-read the issue after the edit form saved it (the bounded 2 s, 5 s and 10 s re-read), so
 * Pending turns into Synced or a failure without a reload.
 *
 * @param {string} projectId - The project's uuid.
 * @param {string} issueId - The issue's uuid.
 * @param {{onIssueChange: Function, onNotFound: Function}} handlers - The setter of the issue
 *   and the callback for an issue that vanished (`404`).
 * @returns {void} Nothing.
 */
export default function useSavedIssueReread(projectId, issueId, { onIssueChange, onNotFound }) {
  const taken = useRef(undefined);
  const reread = useMemo(() => new BoundedRereadController({
    read: () => IssuesClient.show(projectId, issueId),
    onIssue: onIssueChange,
    onNotFound,
  }), [projectId, issueId, onIssueChange, onNotFound]);

  useEffect(() => buildSavedRereadEffect(reread, issueId, taken)(), [reread, issueId]);
}
