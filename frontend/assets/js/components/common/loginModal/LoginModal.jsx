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
 * header or from `ApiClient`'s session-expired handling — in Password, Register, Recover, or
 * Set-new-password mode, and closed the same way. Password / Register converge on the
 * {@link LoginModalController} success path, which closes the modal and redirects home. Recover
 * and Set-new-password instead leave the modal open on a neutral / success result panel.
 *
 * @returns {React.ReactElement} The rendered modal (nothing visible while closed).
 */
export default function LoginModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('password');
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [resetToken, setResetToken] = useState('');
  const [resultPanel, setResultPanel] = useState(null);

  const controller = useMemo(
    () => new LoginModalController(
      setMode, setFields, setFieldErrors, setSubmitError, setResultPanel,
    ),
    [],
  );
  const setters = useMemo(() => ({ setOpen, setResetToken, setResultPanel }), []);

  useLoginModal(controller, setters);

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFields((current) => ({ ...current, [field]: value }));
  };

  const handleSelectMode = (nextMode) => {
    setResultPanel(null);
    setResetToken('');
    controller.switchMode(nextMode);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    return controller.handleSubmit(mode, fields, resetToken);
  };

  return LoginModalHelper.render(
    {
      ...fields, open, mode, fieldErrors, submitError, resultPanel,
    },
    {
      onClose: () => LoginModalEvents.close(),
      onSelectMode: handleSelectMode,
      onSubmit: handleSubmit,
      onUsernameChange: handleFieldChange('username'),
      onEmailChange: handleFieldChange('email'),
      onPasswordChange: handleFieldChange('password'),
      onPasswordConfirmationChange: handleFieldChange('passwordConfirmation'),
    },
  );
}
