import { renderToStaticMarkup } from 'react-dom/server';

const ID_FIELDS = ['username', 'email', 'newPassword', 'newPasswordConfirmation'];

/**
 * Builds the `{ onSubmit, onChange }` handlers, both spies, `onChange` returning a spy.
 *
 * @returns {{onSubmit: jasmine.Spy, onChange: jasmine.Spy}} The spy handlers.
 */
const buildHandlers = () => ({
  onSubmit: jasmine.createSpy('onSubmit'),
  onChange: jasmine.createSpy('onChange').and.returnValue(jasmine.createSpy('handler')),
});

/**
 * Builds a blank page state, including `currentPassword`, with the given overrides applied.
 *
 * @param {object} [overrides] - State attributes overriding the blank defaults.
 * @returns {object} The page state.
 */
const buildState = (overrides = {}) => ({
  username: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  newPasswordConfirmation: '',
  fieldErrors: {},
  submitError: null,
  success: false,
  ...overrides,
});

/**
 * Registers the cases about the page heading, the form and the input ids.
 *
 * @param {Function} renderHtml - `(state, handlers)` returning the rendered static markup.
 * @param {object} options - The options given to the example group.
 * @returns {void}
 */
const registerStructureExamples = (renderHtml, { heading, idPrefix }) => {
  it('renders the page heading', () => {
    expect(renderHtml(buildState(), buildHandlers())).toContain(heading);
  });

  it('wires the form submission to the submit handler', () => {
    const html = renderHtml(buildState(), buildHandlers());

    expect(html).toContain('<form');
    expect(html).toContain('>Save<');
  });

  ID_FIELDS.forEach((name) => {
    it(`gives the ${name} input the id prefixed with ${idPrefix}`, () => {
      const html = renderHtml(buildState(), buildHandlers());

      expect(html).toContain(`id="${idPrefix}${name}"`);
    });
  });
};

/**
 * Registers the cases about the submit-time error alert and the success confirmation.
 *
 * @param {Function} renderHtml - `(state, handlers)` returning the rendered static markup.
 * @param {object} options - The options given to the example group.
 * @returns {void}
 */
const registerAlertExamples = (renderHtml, { successMessage, submitError }) => {
  it('renders the submit-time error alert when present', () => {
    const html = renderHtml(buildState({ submitError }), buildHandlers());

    expect(html).toContain(submitError);
    expect(html).toContain('alert-danger');
  });

  it('renders no submit-error alert when there is none', () => {
    expect(renderHtml(buildState(), buildHandlers())).not.toContain('alert-danger');
  });

  it('renders a success confirmation once the save succeeded', () => {
    const html = renderHtml(buildState({ success: true }), buildHandlers());

    expect(html).toContain('alert-success');
    expect(html).toContain(successMessage);
  });

  it('renders no success confirmation before a save', () => {
    expect(renderHtml(buildState(), buildHandlers())).not.toContain('alert-success');
  });
};

/**
 * Registers the cases about field values, inline errors and change handlers.
 *
 * @param {Function} renderHtml - `(state, handlers)` returning the rendered static markup.
 * @param {object} options - The options given to the example group.
 * @returns {void}
 */
const registerFieldExamples = (renderHtml, { changeFields }) => {
  it('renders the current field values', () => {
    const html = renderHtml(
      buildState({ username: 'foo', email: 'foo@example.com' }),
      buildHandlers(),
    );

    expect(html).toContain('value="foo"');
    expect(html).toContain('value="foo@example.com"');
  });

  it('renders an inline error for an invalid field', () => {
    const html = renderHtml(
      buildState({ fieldErrors: { email: 'Email is invalid' } }),
      buildHandlers(),
    );

    expect(html).toContain('Email is invalid');
    expect(html).toContain('is-invalid');
  });

  it('renders no inline error for a field with no recorded error', () => {
    expect(renderHtml(buildState(), buildHandlers())).not.toContain('is-invalid');
  });

  it('wires each field\'s change handler with its own field name', () => {
    const handlers = buildHandlers();
    renderHtml(buildState(), handlers);

    changeFields.forEach((name) => {
      expect(handlers.onChange).toHaveBeenCalledWith(name);
    });
  });
};

/**
 * Registers the rendering behaviour shared by every helper built on `AccountEditFormHelper`.
 *
 * Must be called inside a `describe`. It registers a `describe('.render')` block with the
 * shared cases and returns the builders so the calling spec can reuse them for its own cases.
 *
 * @param {object} options - How the shared cases must talk to the helper under test.
 * @param {Function} options.Helper - The helper class under test (exposing `render`).
 * @param {string} options.heading - The page heading the helper renders.
 * @param {string} options.successMessage - The success confirmation the helper renders.
 * @param {string} options.submitError - Text used for the submit-error alert case.
 * @param {string} options.idPrefix - The prefix of the input ids (e.g. `my-account-`).
 * @param {string[]} options.changeFields - The field names the change handler is wired with.
 * @returns {{buildHandlers: Function, buildState: Function, renderHtml: Function}} The
 *   `buildHandlers()` and `buildState(overrides)` builders, plus `renderHtml(state, handlers)`
 *   returning the static markup of `Helper.render(state, handlers)`.
 */
export const itBehavesLikeAnAccountEditFormHelper = (options) => {
  const { Helper } = options;
  const renderHtml = (state, handlers) => renderToStaticMarkup(Helper.render(state, handlers));

  describe('.render', () => {
    registerStructureExamples(renderHtml, options);
    registerAlertExamples(renderHtml, options);
    registerFieldExamples(renderHtml, options);
  });

  return { buildHandlers, buildState, renderHtml };
};
