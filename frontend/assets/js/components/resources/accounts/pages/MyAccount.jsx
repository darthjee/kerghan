import { useMemo, useState } from 'react';
import MyAccountController from './controllers/MyAccountController.js';
import MyAccountHelper from './helpers/MyAccountHelper.jsx';

const INITIAL_FIELDS = {
  username: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  newPasswordConfirmation: '',
};

/**
 * My Account page: lets the logged-in user update their username, email, and/or password, each
 * change confirmed by their current password. There is currently no "get my account" read
 * endpoint, so the username/email fields start blank — leaving one blank keeps its current
 * value; a successful save reflects the backend's authoritative username/email back into the
 * form and clears the password fields. Performs no client-side login check of its own — a
 * logged-out `401` on submit is handled entirely by `ApiClient`'s existing refresh/login-modal
 * flow.
 *
 * @returns {React.ReactElement} The rendered My Account page.
 */
export default function MyAccount() {
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(false);

  const controller = useMemo(
    () => new MyAccountController(setFields, setFieldErrors, setSubmitError, setSuccess),
    [],
  );

  const handleChange = (field) => (event) => {
    const { value } = event.target;
    setFields((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    return controller.handleSubmit(fields);
  };

  return MyAccountHelper.render(
    {
      ...fields, fieldErrors, submitError, success,
    },
    { onSubmit: handleSubmit, onChange: handleChange },
  );
}
