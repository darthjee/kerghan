import { useMemo, useState } from 'react';
import LoginController from './controllers/LoginController.js';
import LoginHelper from './helpers/LoginHelper.jsx';

const INITIAL_FIELDS = { username: '', password: '' };

/**
 * Login page. A logged-out flow that, on success, redirects to the home page — no token
 * handling needed here, since `AccountsClient.login` already persists the refresh token via
 * `AuthSession`.
 *
 * @returns {React.ReactElement} The rendered login page.
 */
export default function Login() {
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [submitError, setSubmitError] = useState(null);

  const controller = useMemo(() => new LoginController(setSubmitError), []);

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFields((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    return controller.handleSubmit(fields);
  };

  return LoginHelper.render(
    { ...fields, submitError },
    {
      onSubmit: handleSubmit,
      onUsernameChange: handleFieldChange('username'),
      onPasswordChange: handleFieldChange('password'),
    },
  );
}
