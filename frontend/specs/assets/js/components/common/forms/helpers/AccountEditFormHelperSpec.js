import { renderToStaticMarkup } from 'react-dom/server';
import AccountEditFormHelper from '../../../../../../../assets/js/components/common/forms/helpers/AccountEditFormHelper.jsx';

describe('AccountEditFormHelper', () => {
  const buildHandlers = () => ({
    onSubmit: jasmine.createSpy('onSubmit'),
    onChange: jasmine.createSpy('onChange').and.returnValue(jasmine.createSpy('handler')),
  });
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
  const buildOptions = (overrides = {}) => ({
    heading: 'Some Heading',
    successMessage: 'Saved it.',
    idPrefix: 'some-prefix-',
    ...overrides,
  });
  const leadingFields = [['currentPassword', 'password', 'Current password']];
  const render = (state = buildState(), handlers = buildHandlers(), options = buildOptions()) => (
    renderToStaticMarkup(AccountEditFormHelper.render(state, handlers, options))
  );

  describe('.render', () => {
    it('renders the container and the given heading', () => {
      const html = render();

      expect(html).toContain('<div class="container mt-4"><h1>Some Heading</h1>');
    });

    it('renders the profile fields with the given id prefix', () => {
      const html = render();

      expect(html).toContain('id="some-prefix-username"');
      expect(html).toContain('id="some-prefix-email"');
    });

    it('renders the change-password section and the new-password fields', () => {
      const html = render();

      expect(html).toContain('<hr/>');
      expect(html).toContain('<h2 class="h5">Change password</h2>');
      expect(html).toContain('id="some-prefix-newPassword"');
      expect(html).toContain('id="some-prefix-newPasswordConfirmation"');
    });

    it('renders the save button', () => {
      expect(render()).toContain('<button type="submit" class="btn btn-primary">Save</button>');
    });

    it('wires each field to handlers.onChange(name)', () => {
      const handlers = buildHandlers();

      render(buildState(), handlers);

      expect(handlers.onChange.calls.allArgs().map(([name]) => name)).toEqual([
        'username', 'email', 'newPassword', 'newPasswordConfirmation',
      ]);
    });

    it('renders the current field values', () => {
      const html = render(buildState({ username: 'foo', email: 'foo@example.com' }));

      expect(html).toContain('value="foo"');
      expect(html).toContain('value="foo@example.com"');
    });

    it('renders the submit-time error alert when present', () => {
      const html = render(buildState({ submitError: 'Boom' }));

      expect(html).toContain('<div class="alert alert-danger">Boom</div>');
    });

    it('renders no submit-error alert when there is none', () => {
      expect(render()).not.toContain('alert-danger');
    });

    it('renders the given success message once the save succeeded', () => {
      const html = render(buildState({ success: true }));

      expect(html).toContain('<div class="alert alert-success">Saved it.</div>');
    });

    it('renders no success confirmation before a save', () => {
      expect(render()).not.toContain('alert-success');
    });

    it('renders inline field errors', () => {
      const html = render(buildState({ fieldErrors: { email: 'is invalid' } }));

      expect(html).toContain('is-invalid');
      expect(html).toContain('is invalid');
    });

    describe('without leadingPasswordFields', () => {
      it('renders no current-password field', () => {
        expect(render()).not.toContain('some-prefix-currentPassword');
      });
    });

    describe('with leadingPasswordFields', () => {
      const html = () => render(
        buildState(), buildHandlers(), buildOptions({ leadingPasswordFields: leadingFields }),
      );

      it('renders the leading field with the id prefix', () => {
        expect(html()).toContain('id="some-prefix-currentPassword"');
      });

      it('renders the leading field after the heading and before the new-password fields', () => {
        const markup = html();
        const headingAt = markup.indexOf('Change password</h2>');
        const leadingAt = markup.indexOf('some-prefix-currentPassword');
        const newPasswordAt = markup.indexOf('some-prefix-newPassword"');

        expect(headingAt).toBeLessThan(leadingAt);
        expect(leadingAt).toBeLessThan(newPasswordAt);
      });
    });
  });
});
