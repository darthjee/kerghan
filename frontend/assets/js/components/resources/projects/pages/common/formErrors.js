import ProjectErrorMessages from '../../errors/errorMessages.js';

/**
 * Helpers shared by the project forms to turn validator messages and API refusals into the
 * errors the forms show.
 */
const FormErrors = {
  /**
   * Wrap validator messages as described errors, as the server's errors are.
   *
   * @param {object} errors - A validator's `{ field: message }` map.
   * @returns {object} The `{ field: {message} }` map.
   */
  describeAll(errors) {
    return Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, { message }]));
  },

  /**
   * Show an API refusal where it belongs: on the Name field, on the Repository field, or at
   * form level.
   *
   * @param {Error} error - The thrown error (usually an `ApiError`).
   * @param {Function} setFieldErrors - Setter of the per-field errors.
   * @param {Function} setFormError - Setter of the form-level error.
   * @returns {void} Nothing.
   */
  showRefusal(error, setFieldErrors, setFormError) {
    const field = ProjectErrorMessages.fieldOf(error);
    const described = ProjectErrorMessages.describe(error);

    if (field === 'form') {
      setFormError(described);
    } else {
      setFieldErrors({ [field]: described });
    }
  },
};

export default FormErrors;
