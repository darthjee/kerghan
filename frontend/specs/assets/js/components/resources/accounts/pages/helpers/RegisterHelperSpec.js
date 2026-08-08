import { renderToStaticMarkup } from 'react-dom/server';
import RegisterHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/RegisterHelper.jsx';

describe('RegisterHelper', () => {
  const buildHandlers = () => ({
    onSubmit: jasmine.createSpy('onSubmit'),
    onUsernameChange: jasmine.createSpy('onUsernameChange'),
    onEmailChange: jasmine.createSpy('onEmailChange'),
    onPasswordChange: jasmine.createSpy('onPasswordChange'),
    onPasswordConfirmationChange: jasmine.createSpy('onPasswordConfirmationChange'),
  });
  const buildState = (overrides = {}) => ({
    username: '',
    email: '',
    password: '',
    passwordConfirmation: '',
    fieldErrors: {},
    submitError: null,
    ...overrides,
  });

  describe('.render', () => {
    it('renders the username, email, password, and confirmation fields', () => {
      const html = renderToStaticMarkup(RegisterHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('id="register-username"');
      expect(html).toContain('id="register-email"');
      expect(html).toContain('id="register-password"');
      expect(html).toContain('id="register-passwordConfirmation"');
      expect(html).toContain('Register');
    });

    it('renders the submit error alert when present', () => {
      const html = renderToStaticMarkup(
        RegisterHelper.render(buildState({ submitError: 'username is not available' }), buildHandlers()),
      );

      expect(html).toContain('username is not available');
      expect(html).toContain('alert-danger');
    });

    it('renders no alert when there is no submit error', () => {
      const html = renderToStaticMarkup(RegisterHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('alert-danger');
    });

    it('renders inline field errors', () => {
      const html = renderToStaticMarkup(
        RegisterHelper.render(buildState({ fieldErrors: { username: 'Username is required' } }), buildHandlers()),
      );

      expect(html).toContain('Username is required');
      expect(html).toContain('is-invalid');
    });

    it('renders no inline errors when the form is untouched', () => {
      const html = renderToStaticMarkup(RegisterHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('invalid-feedback');
    });
  });
});
