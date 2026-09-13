import { renderToStaticMarkup } from 'react-dom/server';
import MyAccountHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx';

describe('MyAccountHelper', () => {
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

  describe('.render', () => {
    it('renders the page heading', () => {
      const html = renderToStaticMarkup(MyAccountHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('My Account');
    });

    it('renders the submit-time error alert when present', () => {
      const html = renderToStaticMarkup(
        MyAccountHelper.render(buildState({ submitError: 'Invalid current password' }), buildHandlers()),
      );

      expect(html).toContain('Invalid current password');
      expect(html).toContain('alert-danger');
    });

    it('renders no submit-error alert when there is none', () => {
      const html = renderToStaticMarkup(MyAccountHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('alert-danger');
    });

    it('renders a success confirmation once the save succeeded', () => {
      const html = renderToStaticMarkup(
        MyAccountHelper.render(buildState({ success: true }), buildHandlers()),
      );

      expect(html).toContain('alert-success');
      expect(html).toContain('Account updated.');
    });

    it('renders no success confirmation before a save', () => {
      const html = renderToStaticMarkup(MyAccountHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('alert-success');
    });

    it('renders the current field values', () => {
      const html = renderToStaticMarkup(
        MyAccountHelper.render(buildState({ username: 'foo', email: 'foo@example.com' }), buildHandlers()),
      );

      expect(html).toContain('value="foo"');
      expect(html).toContain('value="foo@example.com"');
    });

    it('renders an inline error for an invalid field', () => {
      const html = renderToStaticMarkup(
        MyAccountHelper.render(buildState({ fieldErrors: { email: 'Email is invalid' } }), buildHandlers()),
      );

      expect(html).toContain('Email is invalid');
      expect(html).toContain('is-invalid');
    });

    it('renders no inline error for a field with no recorded error', () => {
      const html = renderToStaticMarkup(MyAccountHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('is-invalid');
    });

    it('wires each field\'s change handler with its own field name', () => {
      const handlers = buildHandlers();
      renderToStaticMarkup(MyAccountHelper.render(buildState(), handlers));

      expect(handlers.onChange).toHaveBeenCalledWith('username');
      expect(handlers.onChange).toHaveBeenCalledWith('email');
      expect(handlers.onChange).toHaveBeenCalledWith('currentPassword');
      expect(handlers.onChange).toHaveBeenCalledWith('newPassword');
      expect(handlers.onChange).toHaveBeenCalledWith('newPasswordConfirmation');
    });

    it('wires the form submission to the submit handler', () => {
      const html = renderToStaticMarkup(MyAccountHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('<form');
      expect(html).toContain('>Save<');
    });
  });
});
