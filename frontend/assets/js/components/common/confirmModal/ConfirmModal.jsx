import { useMemo, useState } from 'react';
import ConfirmModalController from './controllers/ConfirmModalController.js';
import ConfirmModalHelper from './helpers/ConfirmModalHelper.jsx';

/**
 * Shared confirmation modal: a title, a message, a named confirm action, an optional typed
 * confirmation, an in-flight state and an in-modal error.
 *
 * @description Rendered only while the confirmation is wanted (the owner mounts and unmounts
 * it), so its typed text and error reset on every opening. Cancel takes the initial focus, the
 * confirm button sits on the right and is red for destructive actions. While `onConfirm` is
 * pending both buttons are disabled and Confirm shows a spinner; a rejection's message shows
 * inside the modal, which stays open.
 * @param {{title: string, message: string, confirmLabel: string, danger: (boolean|undefined),
 *   typeToConfirm: (string|undefined), onConfirm: Function, onCancel: Function}} props - The
 *   modal's title, message, confirm button label, destructive flag, text to type before
 *   confirming (optional), the confirmed action (may return a promise) and the cancel callback.
 * @returns {React.ReactElement} The rendered modal.
 */
export default function ConfirmModal({
  title, message, confirmLabel, danger = false, typeToConfirm, onConfirm, onCancel,
}) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const controller = useMemo(() => new ConfirmModalController(setPending, setError), []);

  return ConfirmModalHelper.render(
    {
      title, message, confirmLabel, danger, typeToConfirm, typed, pending, error,
    },
    {
      onCancel,
      onConfirm: () => controller.confirm(onConfirm, pending),
      onTypedChange: (event) => setTyped(event.target.value),
    },
  );
}
