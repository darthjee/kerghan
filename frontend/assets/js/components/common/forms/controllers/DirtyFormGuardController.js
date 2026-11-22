/**
 * Guards a form against losing unsaved changes (U11): in-app leaves (Cancel, links, a hash
 * change) go through a confirmation, and closing or reloading the tab goes through the
 * browser's own `beforeunload` prompt. A clean form leaves silently. Nothing is ever written to
 * `localStorage` or `sessionStorage` (S4).
 *
 * @description The owner calls {@link DirtyFormGuardController#attach} while the form is dirty
 * and {@link DirtyFormGuardController#leave} for its own Cancel; the pending target (the hash
 * the user tried to reach) is published through the setter so a `ConfirmModal` can ask.
 */
export default class DirtyFormGuardController {
  #setPendingHash;

  #accepted = '';

  #bypass = false;

  /**
   * Create the guard.
   *
   * @param {Function} setPendingHash - Setter of the hash waiting for confirmation (`null`
   *   when none).
   */
  constructor(setPendingHash) {
    this.#setPendingHash = setPendingHash;
  }

  /**
   * Start guarding a dirty form: warn on close or reload, and intercept hash changes.
   *
   * @description Does nothing for a clean form. The hash at attach time is the form's own, and
   * is the one restored when a hash change away from the dirty form is intercepted.
   * @param {boolean} isDirty - Whether the form has unsaved changes.
   * @returns {Function} The cleanup, detaching every listener.
   */
  attach(isDirty) {
    if (isDirty === false || typeof window === 'undefined') {
      return () => undefined;
    }

    this.#accepted = window.location.hash;
    this.#bypass = false;

    const onHashChange = () => this.#interceptHashChange();
    const onBeforeUnload = (event) => DirtyFormGuardController.#warnOnUnload(event);

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }

  /**
   * Leave the form for an in-app target (the form's own Cancel or a link).
   *
   * @param {string} targetHash - The hash to go to (e.g. `#/projects`).
   * @param {boolean} isDirty - Whether the form has unsaved changes.
   * @returns {void} Nothing. A clean form navigates at once; a dirty one asks first.
   */
  leave(targetHash, isDirty) {
    if (isDirty) {
      this.#setPendingHash(targetHash);
      return;
    }

    DirtyFormGuardController.#navigate(targetHash);
  }

  /**
   * Confirm discarding: go to the pending target without asking again.
   *
   * @param {(string|null)} pendingHash - The hash waiting for confirmation.
   * @returns {void} Nothing.
   */
  confirmLeave(pendingHash) {
    this.#bypass = true;
    this.#setPendingHash(null);

    if (pendingHash !== null) {
      DirtyFormGuardController.#navigate(pendingHash);
    }
  }

  /**
   * Leave at once, without asking: for the form's own successful save, which navigates away
   * from a form that is still dirty.
   *
   * @param {string} targetHash - The hash to go to.
   * @returns {void} Nothing.
   */
  forceLeave(targetHash) {
    this.#bypass = true;
    DirtyFormGuardController.#navigate(targetHash);
  }

  /**
   * Keep editing: drop the pending target.
   *
   * @returns {void} Nothing.
   */
  cancelLeave() {
    this.#setPendingHash(null);
  }

  #interceptHashChange() {
    const target = window.location.hash;

    if (this.#bypass || target === this.#accepted) {
      return;
    }

    DirtyFormGuardController.#navigate(this.#accepted);
    this.#setPendingHash(target);
  }

  static #navigate(hash) {
    if (typeof window !== 'undefined') {
      window.location.hash = hash;
    }
  }

  static #warnOnUnload(event) {
    event.preventDefault();
     
    event.returnValue = '';
  }
}
