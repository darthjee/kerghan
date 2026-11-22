import ConfirmModal from '../confirmModal/ConfirmModal.jsx';

/**
 * The "Discard unsaved changes?" confirmation of a guarded form (U11).
 *
 * @description Renders nothing until the guard holds a pending hash; then it asks through the
 * shared {@link ConfirmModal}. Cancel (focused by default) keeps editing, and Discard changes
 * goes on to the hash the user tried to reach.
 * @param {{guard: {pendingHash: (string|null), confirmLeave: Function, cancelLeave: Function}}}
 *   props - The guard returned by `useDirtyFormGuard`.
 * @returns {React.ReactElement|null} The modal, or `null` when nothing is pending.
 */
export default function DirtyFormPrompt({ guard }) {
  if (guard.pendingHash === null) {
    return null;
  }

  return (
    <ConfirmModal
      title="Discard unsaved changes?"
      message="You have unsaved changes. If you leave now they will be lost."
      confirmLabel="Discard changes"
      danger
      onConfirm={guard.confirmLeave}
      onCancel={guard.cancelLeave}
    />
  );
}
