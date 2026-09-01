import { useMemo, useState } from 'react';
import ResetPasswordController from './controllers/ResetPasswordController.js';
import ResetPasswordHelper from './helpers/ResetPasswordHelper.jsx';

const INITIAL_FIELDS = { password: '', passwordConfirmation: '' };

/**
 * Extract the `token` query parameter from a hash-based route, SSR-safe. A one-off parse local
 * to this page — `Router#extractParams` handles path params (e.g. `/games/:id`), not query
 * strings.
 *
 * @param {string} [hash] - The hash to parse; defaults to the current `window.location.hash`,
 *   or `''` when `window` is not defined (e.g. during a Node-based spec run).
 * @returns {string|null} The `token` query parameter, or `null` when absent.
 */
function getTokenFromHash(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  const queryString = hash.split('?')[1] || '';
  return new URLSearchParams(queryString).get('token');
}

/**
 * Reset-password page. A logged-out flow that finishes the recovery started on the `Recover`
 * page: reads the recovery token from the current hash's query string, submits it with a new
 * password, and shows a confirmation message with a manual link back to `#/login` on success —
 * no auto-redirect, since the user re-authenticates deliberately with their new password.
 *
 * @returns {React.ReactElement} The rendered reset-password page.
 */
export default function ResetPassword() {
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [resetDone, setResetDone] = useState(false);

  const token = useMemo(() => getTokenFromHash(), []);
  const controller = useMemo(
    () => new ResetPasswordController(setFieldErrors, setSubmitError, setResetDone),
    [],
  );

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFields((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    return controller.handleSubmit(token, fields);
  };

  return ResetPasswordHelper.render(
    {
      ...fields, fieldErrors, submitError, resetDone,
    },
    {
      onSubmit: handleSubmit,
      onPasswordChange: handleFieldChange('password'),
      onPasswordConfirmationChange: handleFieldChange('passwordConfirmation'),
    },
  );
}
