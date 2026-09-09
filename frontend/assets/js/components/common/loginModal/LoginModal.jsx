import { useMemo, useState } from 'react';
import LoginModalController from './controllers/LoginModalController.js';
import LoginModalHelper from './helpers/LoginModalHelper.jsx';
import useLoginModal from './hooks/useLoginModal.js';
import LoginModalEvents from '../../../client/LoginModalEvents.js';

const INITIAL_FIELDS = {
  username: '', email: '', password: '', passwordConfirmation: '',
};

/**
 * Route-independent login modal. Opened via the shared {@link LoginModalEvents} bus — from the
 * header or from `ApiClient`'s session-expired handling — in either Password or Register mode,
 * and closed the same way. On a successful submission the {@link LoginModalController} closes
 * it and redirects home.
 *
 * @returns {React.ReactElement} The rendered modal (nothing visible while closed).
 */
export default function LoginModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('password');
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);

  const controller = useMemo(
    () => new LoginModalController(setMode, setFields, setFieldErrors, setSubmitError),
    [],
  );
  const setters = useMemo(() => ({ setOpen }), []);

  useLoginModal(controller, setters);

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFields((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    return controller.handleSubmit(mode, fields);
  };

  return LoginModalHelper.render(
    {
      ...fields, open, mode, fieldErrors, submitError,
    },
    {
      onClose: () => LoginModalEvents.close(),
      onSelectMode: (nextMode) => controller.switchMode(nextMode),
      onSubmit: handleSubmit,
      onUsernameChange: handleFieldChange('username'),
      onEmailChange: handleFieldChange('email'),
      onPasswordChange: handleFieldChange('password'),
      onPasswordConfirmationChange: handleFieldChange('passwordConfirmation'),
    },
  );
}
