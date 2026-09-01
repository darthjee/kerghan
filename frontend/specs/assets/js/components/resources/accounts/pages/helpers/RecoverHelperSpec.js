import { renderToStaticMarkup } from 'react-dom/server';
import RecoverHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/RecoverHelper.jsx';

describe('RecoverHelper', () => {
  const buildHandlers = () => ({
    onSubmit: jasmine.createSpy('onSubmit'),
    onEmailChange: jasmine.createSpy('onEmailChange'),
  });
  const buildState = (overrides = {}) => ({
    email: '',
    sent: false,
    ...overrides,
  });

  describe('.render', () => {
    it('renders the email field when not yet sent', () => {
      // eslint-disable-next-line xss/no-mixed-html -- server-side renderToStaticMarkup output
      // in a Node-only spec, no DOM/user input involved; same pattern as RegisterSpec.js.
      const html = renderToStaticMarkup(RecoverHelper.render(buildState(), buildHandlers()));

      // eslint-disable-next-line xss/no-mixed-html -- asserting against static test markup
      // only, no DOM/user input involved; same pattern as RegisterSpec.js.
      expect(html).toContain('id="recover-email"');
      // eslint-disable-next-line xss/no-mixed-html -- asserting against static test markup
      // only, no DOM/user input involved; same pattern as RegisterSpec.js.
      expect(html).toContain('Recover');
    });

    it('does not render the confirmation message when not yet sent', () => {
      const html = renderToStaticMarkup(RecoverHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('recovery link');
    });

    it('renders the confirmation message once sent', () => {
      const html = renderToStaticMarkup(
        RecoverHelper.render(buildState({ sent: true }), buildHandlers()),
      );

      expect(html).toContain('recovery link');
    });

    it('does not render the email form once sent', () => {
      const html = renderToStaticMarkup(
        RecoverHelper.render(buildState({ sent: true }), buildHandlers()),
      );

      expect(html).not.toContain('id="recover-email"');
    });
  });
});
