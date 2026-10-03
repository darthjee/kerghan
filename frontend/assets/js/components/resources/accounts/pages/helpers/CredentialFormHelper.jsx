const MODE_LABELS = new Map([
  ['install', 'Install on GitHub'],
  ['connect', 'Connect existing installation'],
]);

/**
 * Render an optional guidance paragraph.
 *
 * @param {string|undefined} text - The text, if the type defines one.
 * @param {string} className - The paragraph's classes.
 * @returns {React.ReactElement|null} The paragraph, or `null` without text.
 */
function renderNote(text, className) {
  if (!text) {
    return null;
  }

  return <p className={className}>{text}</p>;
}

/**
 * Render the type's guidance: settings links, recommendation and warning.
 *
 * @param {object} definition - The integration type definition.
 * @returns {React.ReactElement} The guidance block.
 */
function renderGuidance(definition) {
  return (
    <div className="mb-2">
      {renderNote(definition.recommendation, 'small mb-1')}
      {renderNote(definition.warning, 'small text-warning-emphasis mb-1')}
      <ul className="small mb-0">
        {(definition.links ?? []).map(({ href, label }) => (
          <li key={href}>
            <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Render the label field, unless the form has none (replace credential).
 *
 * @param {object} form - The form description.
 * @param {object} handlers - The form handlers.
 * @returns {React.ReactElement|null} The label field, or `null` without one.
 */
function renderLabelField(form, handlers) {
  if (form.label === undefined) {
    return null;
  }

  const id = `${form.idPrefix}-label`;

  return (
    <div className="mb-2">
      <label htmlFor={id} className="form-label">Label</label>
      <input
        id={id}
        type="text"
        className="form-control"
        value={form.label}
        onChange={handlers.onLabelChange}
      />
    </div>
  );
}

/**
 * Render one credential input: always `type="password"` with `autocomplete="off"`.
 *
 * @param {{name: string, label: string}} field - The credential field.
 * @param {object} form - The form description.
 * @param {object} handlers - The form handlers.
 * @returns {React.ReactElement} The credential field.
 */
function renderCredentialField(field, form, handlers) {
  const id = `${form.idPrefix}-${field.name}`;

  return (
    <div className="mb-2" key={field.name}>
      <label htmlFor={id} className="form-label">{field.label}</label>
      <input
        id={id}
        type="password"
        autoComplete="off"
        className="form-control"
        value={form.credential?.[field.name] ?? ''}
        onChange={handlers.onCredentialChange(field.name)}
      />
    </div>
  );
}

/**
 * Render the form's error, if any.
 *
 * @param {string|null} error - The error message.
 * @returns {React.ReactElement|null} The error, or `null` without one.
 */
function renderError(error) {
  if (!error) {
    return null;
  }

  return <div className="text-danger mb-2">{error}</div>;
}

/**
 * Render one picker choice per available type, or a notice when there is none.
 *
 * @param {Array<object>} types - The available type definitions.
 * @param {{onPickType: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|Array<React.ReactElement>} The choices, or the notice.
 */
function renderTypeChoices(types, handlers) {
  if (types.length === 0) {
    return <p>No integration type is available on this server.</p>;
  }

  return types.map((definition) => (
    <button
      key={definition.type}
      type="button"
      className="btn btn-outline-primary text-start mb-2"
      onClick={handlers.onPickType(definition.type)}
    >
      <strong>{definition.name}</strong>
      <div className="small">{definition.description}</div>
    </button>
  ));
}

/**
 * Render a redirect-flow type's warnings, shown before continuing to GitHub.
 *
 * @param {Array<string>} warnings - The type's warnings.
 * @returns {React.ReactElement} The warnings list.
 */
function renderWarnings(warnings) {
  return (
    <ul className="small text-warning-emphasis mb-2">
      {warnings.map((warning) => <li key={warning}>{warning}</li>)}
    </ul>
  );
}

/**
 * Render the submit controls of a redirect form: one button per mode for a type offering
 * several (GitHub App), else a single *Continue to GitHub* submit button.
 *
 * @param {object} definition - The integration type definition.
 * @param {{onSubmitMode: (Function|undefined)}} handlers - Event handlers; `onSubmitMode` is
 *   curried by mode.
 * @returns {React.ReactElement|Array<React.ReactElement>} The submit controls.
 */
function renderRedirectSubmit(definition, handlers) {
  if (!definition.modes) {
    return <button type="submit" className="btn btn-primary me-2">Continue to GitHub</button>;
  }

  return definition.modes.map((mode) => (
    <div key={mode} className="mb-2">
      <button type="button" className="btn btn-primary" onClick={handlers.onSubmitMode(mode)}>
        {MODE_LABELS.get(mode)}
      </button>
      {renderNote(mode === 'connect' ? definition.connectHint : undefined, 'small text-muted mb-0')}
    </div>
  ));
}

/**
 * Rendering helper for the type picker and the credential-paste forms (add and replace
 * credential), driven by the type registry's definitions; a redirect-flow type gets a
 * label-only form instead.
 */
const CredentialFormHelper = {
  /**
   * Render the type picker: one choice per available type, with its description.
   *
   * @param {Array<object>} types - The available type definitions.
   * @param {{onPickType: Function, onCancel: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The type picker.
   */
  renderTypePicker(types, handlers) {
    return (
      <div className="card card-body mb-3">
        <h2 className="h5">Choose a type</h2>
        {renderTypeChoices(types, handlers)}
        <div>
          <button type="button" className="btn btn-link" onClick={handlers.onCancel}>Cancel</button>
        </div>
      </div>
    );
  },

  /**
   * Render a type's form: the credential-paste form, or the redirect form for a type with
   * `flow: 'redirect'`.
   *
   * @param {{definition: object, idPrefix: string, label: (string|undefined), credential: object,
   *   error: (string|null), title: string, submitLabel: string}} form - The form description;
   *   `label` is `undefined` for a form without a label field (replace credential).
   * @param {{onSubmit: Function, onLabelChange: Function, onCredentialChange: Function,
   *   onCancel: Function}} handlers - Event handlers; `onCredentialChange` is curried by field
   *   name.
   * @returns {React.ReactElement} The credential form.
   */
  renderForm(form, handlers) {
    if (form.definition.flow === 'redirect') {
      return CredentialFormHelper.renderRedirectForm(form, handlers);
    }

    return (
      <form className="card card-body mb-3" onSubmit={handlers.onSubmit}>
        <h2 className="h5">{form.title}</h2>
        {renderGuidance(form.definition)}
        {renderLabelField(form, handlers)}
        {form.definition.credentialFields.map((field) => renderCredentialField(field, form, handlers))}
        {renderError(form.error)}
        <div>
          <button type="submit" className="btn btn-primary me-2">{form.submitLabel}</button>
          <button type="button" className="btn btn-link" onClick={handlers.onCancel}>Cancel</button>
        </div>
      </form>
    );
  },

  /**
   * Render a redirect-flow form: only *Label*, the type's warnings and a *Continue to GitHub*
   * button (or one button per mode, e.g. *Install on GitHub* and *Connect existing
   * installation*). There is no credential input.
   *
   * @param {{definition: object, idPrefix: string, label: string, error: (string|null),
   *   title: string}} form - The form description.
   * @param {{onSubmit: Function, onSubmitMode: (Function|undefined), onLabelChange: Function,
   *   onCancel: Function}} handlers - Event handlers; `onSubmitMode` (curried by mode) is
   *   needed for a type with `modes`.
   * @returns {React.ReactElement} The redirect form.
   */
  renderRedirectForm(form, handlers) {
    return (
      <form className="card card-body mb-3" onSubmit={handlers.onSubmit}>
        <h2 className="h5">{form.title}</h2>
        {renderNote(form.definition.description, 'small mb-1')}
        {renderWarnings(form.definition.warnings ?? [])}
        {renderLabelField(form, handlers)}
        {renderError(form.error)}
        <div>
          {renderRedirectSubmit(form.definition, handlers)}
          <button type="button" className="btn btn-link" onClick={handlers.onCancel}>Cancel</button>
        </div>
      </form>
    );
  },
};

export default CredentialFormHelper;
