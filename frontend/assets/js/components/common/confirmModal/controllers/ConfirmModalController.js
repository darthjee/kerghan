/**
 * Behaviour of the shared confirmation modal: when Confirm is allowed, and running the
 * confirmed call with its in-flight and error states.
 */
export default class ConfirmModalController {
  #setPending;

  #setError;

  /**
   * Create the controller.
   *
   * @param {Function} setPending - Setter of the in-flight flag.
   * @param {Function} setError - Setter of the in-modal error message (`null` clears it).
   */
  constructor(setPending, setError) {
    this.#setPending = setPending;
    this.#setError = setError;
  }

  /**
   * Tell whether the typed confirmation is satisfied (U9).
   *
   * @param {(string|undefined)} typeToConfirm - The text that must be typed, if any.
   * @param {string} typed - What the user typed.
   * @returns {boolean} `true` when no text is required, or when the trimmed typed value equals
   *   the text exactly (case-sensitive).
   */
  static isConfirmed(typeToConfirm, typed) {
    return typeToConfirm === undefined || typeToConfirm === null || typed.trim() === typeToConfirm;
  }

  /**
   * Run the confirmed call: mark it in flight, and show a rejection's message in the modal.
   *
   * @description Does nothing while a call is already in flight (U2). On success the owner is
   * expected to close the modal; the in-flight flag is cleared either way.
   * @param {Function} onConfirm - The confirmed action; may return a promise.
   * @param {boolean} pending - Whether a call is already in flight.
   * @returns {Promise<void>} Resolves when the call settled.
   */
  async confirm(onConfirm, pending) {
    if (pending) {
      return;
    }

    this.#setError(null);
    this.#setPending(true);

    try {
      await onConfirm();
    } catch (error) {
      this.#setError(error?.message || 'Request failed');
    } finally {
      this.#setPending(false);
    }
  }
}
