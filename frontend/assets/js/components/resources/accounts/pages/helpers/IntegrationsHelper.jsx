import IntegrationTypes from '../integrations/types/index.js';
import CredentialFormHelper from './CredentialFormHelper.jsx';
import IntegrationsTableHelper from './IntegrationsTableHelper.jsx';

/**
 * Render the "Add integration" button.
 *
 * @param {{onOpenAdd: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The button.
 */
function renderAddButton(handlers) {
  return (
    <button type="button" className="btn btn-primary mb-3" onClick={handlers.onOpenAdd}>
      Add integration
    </button>
  );
}

/**
 * Render the open add flow: the type picker, then the chosen type's credential-paste form.
 *
 * @param {{types: Array<object>, addForm: object}} state - Page state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The type picker or the add form.
 */
function renderAddFlow(state, handlers) {
  const { addForm } = state;
  const definition = IntegrationTypes.get(addForm.type);

  if (!definition) {
    return CredentialFormHelper.renderTypePicker(
      state.types,
      { onPickType: handlers.onPickType, onCancel: handlers.onCancelAdd },
    );
  }

  return CredentialFormHelper.renderForm(
    {
      definition,
      idPrefix: 'add-integration',
      label: addForm.label,
      credential: addForm.credential,
      error: addForm.error,
      title: `Add ${definition.name}`,
      submitLabel: 'Add',
    },
    {
      onSubmit: handlers.onSubmitAdd,
      onLabelChange: handlers.onAddLabelChange,
      onCredentialChange: handlers.onAddCredentialChange,
      onCancel: handlers.onCancelAdd,
    },
  );
}

/**
 * Render the add section: the open add flow, or the "Add integration" button.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The add flow or the button.
 */
function renderAddSection(state, handlers) {
  if (state.addForm.open) {
    return renderAddFlow(state, handlers);
  }

  return renderAddButton(handlers);
}

/**
 * Render the loaded content: the add flow (or button), then the table or the empty state.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The loaded content.
 */
function renderContent(state, handlers) {
  return (
    <>
      {renderAddSection(state, handlers)}
      {renderList(state, handlers)}
    </>
  );
}

/**
 * Render the integrations table, or the empty state when there is none.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The table or the empty state.
 */
function renderList(state, handlers) {
  if (state.integrations.length === 0) {
    return (
      <p>
        You have no integrations yet. Integrations let Kerghan read your GitHub issues with your
        own credentials, including on private repositories.
      </p>
    );
  }

  return IntegrationsTableHelper.render(state, handlers);
}

/**
 * Render the load error with a retry action.
 *
 * @param {string} error - The load error message.
 * @param {{onRetry: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The error block.
 */
function renderLoadError(error, handlers) {
  return (
    <div className="alert alert-danger">
      {error}
      <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={handlers.onRetry}>
        Retry
      </button>
    </div>
  );
}

/**
 * Render the page body for the current load state.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The loading message, the error, or the loaded content.
 */
function renderBody(state, handlers) {
  if (state.loadState.loading) {
    return <p>Loading integrations…</p>;
  }

  if (state.loadState.error) {
    return renderLoadError(state.loadState.error, handlers);
  }

  return renderContent(state, handlers);
}

/**
 * Render the page-level notice (e.g. the OAuth App landing outcome), if any.
 *
 * @param {{variant: string, text: string}|null} notice - The notice.
 * @param {{onDismissNotice: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The notice, or `null` without one.
 */
function renderNotice(notice, handlers) {
  if (!notice) {
    return null;
  }

  return (
    <div className={`alert alert-${notice.variant} d-flex justify-content-between align-items-start`} role="status">
      <span>{notice.text}</span>
      <button type="button" className="btn-close" aria-label="Dismiss" onClick={handlers.onDismissNotice} />
    </div>
  );
}

/**
 * Rendering helper for the "My account → Integrations" page.
 */
const IntegrationsHelper = {
  /**
   * Render the Integrations page.
   *
   * @param {{integrations: Array<object>, types: Array<object>, loadState: object,
   *   rowState: Map, addForm: object, notice: (object|null)}} state - Page state.
   * @param {object} handlers - Event handlers built by `IntegrationsHandlers`.
   * @returns {React.ReactElement} The rendered Integrations page.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <h1>Integrations</h1>
        {renderNotice(state.notice, handlers)}
        {renderBody(state, handlers)}
      </div>
    );
  },
};

export default IntegrationsHelper;
