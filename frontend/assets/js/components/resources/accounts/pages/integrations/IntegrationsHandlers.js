import { CLOSED_ADD_FORM } from '../controllers/IntegrationsController.js';
import RedirectFlows from './redirectFlows.js';

/**
 * Wrap a submit action so the browser's default form submission (which would navigate) is
 * prevented first.
 *
 * @param {Function} action - Zero-argument action to run.
 * @returns {Function} The submit event handler.
 */
function onSubmit(action) {
  return (event) => {
    event.preventDefault();
    return action();
  };
}

/**
 * Build the add form's handlers.
 *
 * @param {object} controller - The page's `IntegrationsController`.
 * @param {object} addForm - The current add form state.
 * @returns {object} The add form handlers.
 */
function addFormHandlers(controller, addForm) {
  return {
    onOpenAdd: () => controller.setAddForm({ ...CLOSED_ADD_FORM, open: true }),
    onCancelAdd: () => controller.setAddForm(CLOSED_ADD_FORM),
    onPickType: (type) => () => controller.patchAddForm({ type, credential: {} }),
    onAddLabelChange: (event) => controller.patchAddForm({ label: event.target.value }),
    onAddCredentialChange: (field) => (event) => controller.patchAddForm({
      credential: { ...addForm.credential, [field]: event.target.value },
    }),
    onSubmitAdd: onSubmit(() => controller.create(addForm)),
  };
}

/**
 * Build the rename and replace-credential handlers of the rows.
 *
 * @param {object} controller - The page's `IntegrationsController`.
 * @param {Map} rowState - The per-row UI state, keyed by uuid.
 * @returns {object} The row edit handlers.
 */
function rowEditHandlers(controller, rowState) {
  const rowOf = (uuid) => rowState.get(uuid) ?? {};

  return {
    onStartRename: ({ id, label }) => () => controller.patchRow(id, { renaming: true, label, error: null }),
    onRenameChange: (uuid) => (event) => controller.patchRow(uuid, { label: event.target.value }),
    onCancelRename: (uuid) => () => controller.patchRow(uuid, { renaming: false }),
    onSubmitRename: (uuid) => onSubmit(() => controller.rename(uuid, rowOf(uuid).label ?? '')),
    onStartReplace: (uuid) => () => controller.patchRow(uuid, { replacing: true, credential: {}, error: null }),
    onReplaceCredentialChange: (uuid, field) => (event) => controller.patchRow(uuid, {
      credential: { ...rowOf(uuid).credential, [field]: event.target.value },
    }),
    onCancelReplace: (uuid) => () => controller.patchRow(uuid, { replacing: false, credential: {} }),
    onReconnect: ({ id, type }, mode) => () => controller.startRedirect(
      type, RedirectFlows.startBody({ integrationId: id }, mode),
    ),
    onSubmitReplace: (integration) => onSubmit(
      () => controller.replaceCredential(integration, rowOf(integration.id).credential ?? {}),
    ),
  };
}

/**
 * Builds the Integrations page's event handlers on top of its controller.
 */
const IntegrationsHandlers = {
  /**
   * Build every handler the Integrations page hands to its rendering helper. Per-row handlers
   * are curried by uuid (or integration) so each row gets its own callback.
   *
   * @param {object} controller - The page's `IntegrationsController`.
   * @param {{addForm: object, rowState: Map}} state - The page's current add form and row
   *   state.
   * @returns {object} The page handlers.
   */
  build(controller, { addForm, rowState }) {
    return {
      onRetry: () => controller.retry(),
      onDismissNotice: () => controller.setNotice(null),
      ...addFormHandlers(controller, addForm),
      ...rowEditHandlers(controller, rowState),
      onAskRemove: (uuid) => () => controller.patchRow(uuid, { confirmingRemove: true, error: null }),
      onCancelRemove: (uuid) => () => controller.patchRow(uuid, { confirmingRemove: false }),
      onConfirmRemove: (uuid) => () => controller.remove(uuid),
      onTest: (uuid) => () => controller.test(uuid),
    };
  },
};

export default IntegrationsHandlers;
