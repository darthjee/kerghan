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
      // eslint-disable-next-line xss/no-mixed-html -- server-side renderToStaticMarkup output
      // in a Node-only spec, no DOM/user input involved; same pattern as RegisterSpec.js.
      const html = renderToStaticMarkup(LoginHelper.render(buildState(), buildHandlers()));

      // eslint-disable-next-line xss/no-mixed-html -- asserting against static test markup
      // only, no DOM/user input involved; same pattern as RegisterSpec.js.
      expect(html).toContain('id="login-username"');
      // eslint-disable-next-line xss/no-mixed-html -- asserting against static test markup
      // only, no DOM/user input involved; same pattern as RegisterSpec.js.
      expect(html).toContain('id="login-password"');
      // eslint-disable-next-line xss/no-mixed-html -- asserting against static test markup
      // only, no DOM/user input involved; same pattern as RegisterSpec.js.
      expect(html).toContain('Login');
    });

    it('renders the submit error alert when present', () => {
      // eslint-disable-next-line xss/no-mixed-html -- server-side renderToStaticMarkup output
      // in a Node-only spec, no DOM/user input involved; same pattern as RegisterSpec.js.
      const html = renderToStaticMarkup(
        LoginHelper.render(buildState({ submitError: 'invalid credentials' }), buildHandlers()),
      );

      // eslint-disable-next-line xss/no-mixed-html -- asserting against static test markup
      // only, no DOM/user input involved; same pattern as RegisterSpec.js.
      expect(html).toContain('invalid credentials');
      // eslint-disable-next-line xss/no-mixed-html -- asserting against static test markup
      // only, no DOM/user input involved; same pattern as RegisterSpec.js.
      expect(html).toContain('alert-danger');
    });

    it('renders no alert when there is no submit error', () => {
      const html = renderToStaticMarkup(LoginHelper.render(buildState(), buildHandlers()));

      // eslint-disable-next-line xss/no-mixed-html -- asserting against static test markup
      // only, no DOM/user input involved; same pattern as RegisterSpec.js.
      expect(html).not.toContain('alert-danger');
    });
  });
});
