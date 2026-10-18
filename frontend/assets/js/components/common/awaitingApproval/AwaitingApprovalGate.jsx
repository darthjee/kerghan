import AwaitingApproval from './AwaitingApproval.jsx';

/**
 * Swap the app content for the {@link AwaitingApproval} view while the account is pending.
 *
 * @description Renders `children` unchanged when not pending, so a re-check answering
 * `loggedIn: true` shows the app again with no new login.
 * @param {object} props - Component props.
 * @param {boolean} props.pending - Whether the account awaits an administrator's approval.
 * @param {React.ReactNode} [props.children] - The app content shown when not pending.
 * @returns {React.ReactNode} The awaiting-approval view, or `children`.
 */
export default function AwaitingApprovalGate({ pending, children }) {
  if (pending) {
    return <AwaitingApproval />;
  }

  return children;
}
