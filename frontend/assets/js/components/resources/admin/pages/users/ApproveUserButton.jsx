/**
 * "Approve" button for a single admin users row.
 *
 * @description Renders nothing unless the user is `pending`, since the API refuses to approve
 *   any other status.
 * @param {object} props - Component props.
 * @param {{id: number, status: string}} props.user - The row's user account.
 * @param {Function} props.onApprove - Handler factory: called with the user id, returns the
 *   click handler.
 * @returns {React.ReactElement|null} The rendered button, or `null` when approval is not offered.
 */
export default function ApproveUserButton({ user, onApprove }) {
  if (user.status !== 'pending') {
    return null;
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-success me-2"
      onClick={onApprove(user.id)}
    >
      Approve
    </button>
  );
}
