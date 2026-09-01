import { useMemo, useState } from 'react';
import RecoverController from './controllers/RecoverController.js';
import RecoverHelper from './helpers/RecoverHelper.jsx';

const INITIAL_FIELDS = { email: '' };

/**
 * Recover page. A logged-out flow requesting a password recovery email. Always shows the same
 * "check your email" confirmation once submitted, regardless of whether the email matched an
 * account or the request itself failed — the enumeration-safety contract carried into the UI
 * layer (see `RecoverController`).
 *
 * @returns {React.ReactElement} The rendered recover page.
 */
export default function Recover() {
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [sent, setSent] = useState(false);

  const controller = useMemo(() => new RecoverController(setSent), []);

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFields((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    return controller.handleSubmit(fields.email);
  };

  return RecoverHelper.render(
    { ...fields, sent },
    {
      onSubmit: handleSubmit,
      onEmailChange: handleFieldChange('email'),
    },
  );
}
