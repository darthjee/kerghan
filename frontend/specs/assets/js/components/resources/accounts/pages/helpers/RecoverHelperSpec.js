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
      const html = renderToStaticMarkup(RecoverHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('id="recover-email"');
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
