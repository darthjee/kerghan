import { renderToStaticMarkup } from 'react-dom/server';
import LoginHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/LoginHelper.jsx';

describe('LoginHelper', () => {
  const buildHandlers = () => ({
    onSubmit: jasmine.createSpy('onSubmit'),
    onUsernameChange: jasmine.createSpy('onUsernameChange'),
    onPasswordChange: jasmine.createSpy('onPasswordChange'),
  });
  const buildState = (overrides = {}) => ({
    username: '',
    password: '',
    submitError: null,
    ...overrides,
  });

  describe('.render', () => {
    it('renders the username and password fields', () => {
      const html = renderToStaticMarkup(LoginHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('id="login-username"');
      expect(html).toContain('id="login-password"');
      expect(html).toContain('Login');
    });

    it('renders the submit error alert when present', () => {
      const html = renderToStaticMarkup(
        LoginHelper.render(buildState({ submitError: 'invalid credentials' }), buildHandlers()),
      );

      expect(html).toContain('invalid credentials');
      expect(html).toContain('alert-danger');
    });

    it('renders no alert when there is no submit error', () => {
      const html = renderToStaticMarkup(LoginHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('alert-danger');
    });
  });
});
