import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ResetPasswordLanding, { redirectToResetModal } from '../../../../../../../assets/js/components/resources/accounts/pages/ResetPasswordLanding.jsx';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';

describe('ResetPasswordLanding', () => {
  let originalWindow;

  beforeEach(() => {
    originalWindow = globalThis.window;
    globalThis.window = { location: { hash: '#/recover-password?token=abc' } };
    spyOn(LoginModalEvents, 'open');
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  describe('redirectToResetModal', () => {
    it('opens the login modal in resetPassword mode with the hash token', () => {
      redirectToResetModal();

      expect(LoginModalEvents.open).toHaveBeenCalledWith('resetPassword', { token: 'abc' });
    });

    it('sends the URL hash back to the home route', () => {
      redirectToResetModal();

      expect(globalThis.window.location.hash).toBe('/');
    });

    it('passes a null token when the hash carries no token query param', () => {
      globalThis.window = { location: { hash: '#/recover-password' } };

      redirectToResetModal();

      expect(LoginModalEvents.open).toHaveBeenCalledWith('resetPassword', { token: null });
    });
  });

  describe('component', () => {
    it('renders nothing', () => {
      const markup = renderToStaticMarkup(
        React.createElement('div', null, React.createElement(ResetPasswordLanding)),
      );

      expect(markup).toBe('<div></div>');
    });
  });
});
