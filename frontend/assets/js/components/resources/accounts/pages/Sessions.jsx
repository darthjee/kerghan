import { useEffect, useMemo, useState } from 'react';
import SessionsController from './controllers/SessionsController.js';
import SessionsHelper from './helpers/SessionsHelper.jsx';

const INITIAL_SESSIONS = [];
const INITIAL_ROW_STATE = new Map();
const INITIAL_PAGE_STATE = { confirmingRevokeOthers: false, error: null };

/**
 * Build the mount-time load effect: triggers `controller.load()` once, unconditionally — a
 * logged-out `401` is handled entirely by `ApiClient`'s refresh/login-modal flow. Extracted as a
 * plain function so it can be exercised directly in tests without a React renderer.
 *
 * @param {SessionsController} controller - The page's controller.
 * @returns {Function} Effect callback.
 */
export function buildLoadEffect(controller) {
  return () => {
    controller.load();
  };
}

/**
 * Sessions page: lists the caller's sessions and lets them revoke any non-current one, or sign
 * out every other session at once after a confirmation step.
 *
 * @returns {React.ReactElement} The rendered Sessions page.
 */
export default function Sessions() {
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [loadError, setLoadError] = useState(null);
  const [rowState, setRowState] = useState(INITIAL_ROW_STATE);
  const [pageState, setPageState] = useState(INITIAL_PAGE_STATE);

  const controller = useMemo(
    () => new SessionsController(setSessions, setLoadError, setRowState, setPageState),
    [],
  );

  useEffect(() => buildLoadEffect(controller)(), [controller]);

  return SessionsHelper.render(
    {
      sessions, loadError, rowState, pageState,
    },
    {
      onRevoke: (id) => () => controller.revoke(id),
      onRequestRevokeOthers: () => controller.requestRevokeOthers(),
      onConfirmRevokeOthers: () => controller.confirmRevokeOthers(),
      onCancelRevokeOthers: () => controller.cancelRevokeOthers(),
    },
  );
}
