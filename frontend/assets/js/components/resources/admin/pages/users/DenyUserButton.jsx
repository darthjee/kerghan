/**
 * "Deny" button for a single admin users row.
 *
 * @description Renders nothing for an already `denied` user or for the calling admin's own row,
 *   since the API refuses both. It is still offered on the default user's row; its `409` message
 *   is then shown as a row error.
 * @param {object} props - Component props.
 * @param {{id: number, status: string}} props.user - The row's user account.
 * @param {number|null} props.currentUserId - The calling admin's own id.
 * @param {Function} props.onDeny - Handler factory: called with the user id, returns the click
 *   handler.
 * @returns {React.ReactElement|null} The rendered button, or `null` when denial is not offered.
 */
export default function DenyUserButton({ user, currentUserId, onDeny }) {
  if (user.status === 'denied' || user.id === currentUserId) {
    return null;
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-danger me-2"
      onClick={onDeny(user.id)}
    >
      Deny
    </button>
  );
}
