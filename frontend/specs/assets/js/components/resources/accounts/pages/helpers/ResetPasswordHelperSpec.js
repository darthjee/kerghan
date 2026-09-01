import { renderToStaticMarkup } from 'react-dom/server';
import ResetPasswordHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/ResetPasswordHelper.jsx';

describe('ResetPasswordHelper', () => {
  const buildHandlers = () => ({
    onSubmit: jasmine.createSpy('onSubmit'),
    onPasswordChange: jasmine.createSpy('onPasswordChange'),
    onPasswordConfirmationChange: jasmine.createSpy('onPasswordConfirmationChange'),
  });
  const buildState = (overrides = {}) => ({
    password: '',
    passwordConfirmation: '',
    fieldErrors: {},
    submitError: null,
    resetDone: false,
    ...overrides,
  });

  describe('.render', () => {
    it('renders the password and confirmation fields when not yet reset', () => {
      const html = renderToStaticMarkup(ResetPasswordHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('id="reset-password-password"');
      expect(html).toContain('id="reset-password-passwordConfirmation"');
    });

    it('renders the submit error alert when present', () => {
      const html = renderToStaticMarkup(
        ResetPasswordHelper.render(buildState({ submitError: 'Invalid or expired token' }), buildHandlers()),
      );

      expect(html).toContain('Invalid or expired token');
      expect(html).toContain('alert-danger');
    });

    it('renders no alert when there is no submit error', () => {
      const html = renderToStaticMarkup(ResetPasswordHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('alert-danger');
    });

    it('renders inline field errors', () => {
      const html = renderToStaticMarkup(
        ResetPasswordHelper.render(buildState({ fieldErrors: { password: 'Password is required' } }), buildHandlers()),
      );

      expect(html).toContain('Password is required');
      expect(html).toContain('is-invalid');
    });

    it('renders no inline errors when the form is untouched', () => {
      const html = renderToStaticMarkup(ResetPasswordHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('invalid-feedback');
    });

    it('renders the confirmation message and login link once reset', () => {
      const html = renderToStaticMarkup(
        ResetPasswordHelper.render(buildState({ resetDone: true }), buildHandlers()),
      );

      expect(html).toContain('Your password has been reset');
      expect(html).toContain('href="#/login"');
    });

    it('does not render the form once reset', () => {
      const html = renderToStaticMarkup(
        ResetPasswordHelper.render(buildState({ resetDone: true }), buildHandlers()),
      );

      expect(html).not.toContain('id="reset-password-password"');
    });
  });
});
