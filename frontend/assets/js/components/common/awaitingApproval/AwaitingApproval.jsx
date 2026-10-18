import { useMemo, useState } from 'react';
import AwaitingApprovalController from './controllers/AwaitingApprovalController.js';
import AwaitingApprovalHelper from './helpers/AwaitingApprovalHelper.jsx';
import useWindowFocusRecheck from './hooks/useWindowFocusRecheck.js';

/**
 * Full-page view shown instead of the app content while the account awaits an administrator's
 * approval. Offers "Check again" and "Log out", and re-checks the status on every window focus
 * (never on a timer) via {@link useWindowFocusRecheck}.
 *
 * @returns {React.ReactElement} The rendered awaiting-approval view.
 */
export default function AwaitingApproval() {
  const [error, setError] = useState(null);
  const controller = useMemo(() => new AwaitingApprovalController(setError), []);

  useWindowFocusRecheck(controller);

  return AwaitingApprovalHelper.render(
    { error },
    {
      onCheckAgain: () => controller.checkAgain(),
      onLogout: () => controller.logout(),
    },
  );
}
