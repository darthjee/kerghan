import { useEffect, useMemo, useState } from 'react';
import IntegrationsController, { CLOSED_ADD_FORM } from './controllers/IntegrationsController.js';
import IntegrationsHelper from './helpers/IntegrationsHelper.jsx';
import IntegrationsHandlers from './integrations/IntegrationsHandlers.js';

const INITIAL_LIST = [];
const INITIAL_LOAD_STATE = { loading: true, error: null };
const INITIAL_ROW_STATE = new Map();

/**
 * Build the mount-time effect: triggers `controller.load()` once, with no login check of its
 * own (a logged-out `401` is handled by `ApiClient`'s refresh/login-modal flow), and returns a
 * cleanup disposing the controller's cooldown timers on unmount.
 *
 * @param {IntegrationsController} controller - The page's controller.
 * @returns {Function} Effect callback, returning its cleanup.
 */
export function buildLoadEffect(controller) {
  return () => {
    controller.load();
    return () => controller.dispose();
  };
}

/**
 * Integrations page (`#/account/integrations`): lists and manages the caller's GitHub
 * integrations (add, rename, replace credential, remove, test connection).
 *
 * @returns {React.ReactElement} The rendered Integrations page.
 */
export default function Integrations() {
  const [integrations, setIntegrations] = useState(INITIAL_LIST);
  const [types, setTypes] = useState(INITIAL_LIST);
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);
  const [rowState, setRowState] = useState(INITIAL_ROW_STATE);
  const [addForm, setAddForm] = useState(CLOSED_ADD_FORM);

  const controller = useMemo(() => new IntegrationsController({
    setIntegrations, setTypes, setLoadState, setRowState, setAddForm,
  }), []);

  useEffect(() => buildLoadEffect(controller)(), [controller]);

  return IntegrationsHelper.render(
    {
      integrations, types, loadState, rowState, addForm,
    },
    IntegrationsHandlers.build(controller, { addForm, rowState }),
  );
}
