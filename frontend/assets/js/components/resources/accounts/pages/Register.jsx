import { useMemo, useState } from 'react';
import RegisterController from './controllers/RegisterController.js';
import RegisterHelper from './helpers/RegisterHelper.jsx';

const INITIAL_FIELDS = {
  username: '', email: '', password: '', passwordConfirmation: '',
};

/**
 * Registration page. A logged-out flow that, on success, redirects to the home page — no
 * token to store client-side, since the session cookie is already set by the backend's
 * `Set-Cookie` response header.
 *
 * @returns {React.ReactElement} The rendered register page.
 */
export default function Register() {
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);

  const controller = useMemo(
    () => new RegisterController(setFieldErrors, setSubmitError),
    [],
  );

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFields((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    return controller.handleSubmit(fields);
  };

  return RegisterHelper.render(
    { ...fields, fieldErrors, submitError },
    {
      onSubmit: handleSubmit,
      onUsernameChange: handleFieldChange('username'),
      onEmailChange: handleFieldChange('email'),
      onPasswordChange: handleFieldChange('password'),
      onPasswordConfirmationChange: handleFieldChange('passwordConfirmation'),
    },
  );
}
