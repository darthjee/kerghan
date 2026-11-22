import { useEffect, useMemo, useState } from 'react';
import DirtyFormGuardController from '../controllers/DirtyFormGuardController.js';

/**
 * Guard a form against losing unsaved changes (U11).
 *
 * @description While `isDirty` is true, the browser warns on close or reload, and a hash change
 * away from the form is undone and held as `pendingHash`, waiting for the user's answer (see
 * {@link DirtyFormPrompt}). The form's own Cancel goes through `leave`. A clean form leaves
 * silently. Nothing is stored in `localStorage` or `sessionStorage` (S4).
 * @param {boolean} isDirty - Whether the form has unsaved changes.
 * @returns {{pendingHash: (string|null), leave: Function, confirmLeave: Function,
 *   cancelLeave: Function, forceLeave: Function}} The hash waiting for confirmation (`null`
 *   when none), `leave(hash)` to go to a hash (asking first when dirty), `confirmLeave()` to
 *   discard and go on, `cancelLeave()` to keep editing, and `forceLeave(hash)` to go without
 *   asking (after a successful save).
 */
export default function useDirtyFormGuard(isDirty) {
  const [pendingHash, setPendingHash] = useState(null);
  const controller = useMemo(() => new DirtyFormGuardController(setPendingHash), []);

  useEffect(() => controller.attach(isDirty), [controller, isDirty]);

  return {
    pendingHash,
    leave: (targetHash) => controller.leave(targetHash, isDirty),
    confirmLeave: () => controller.confirmLeave(pendingHash),
    cancelLeave: () => controller.cancelLeave(),
    forceLeave: (targetHash) => controller.forceLeave(targetHash),
  };
}
