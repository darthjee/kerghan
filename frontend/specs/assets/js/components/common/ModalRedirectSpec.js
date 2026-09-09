import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ModalRedirect, { redirectToModal } from '../../../../../assets/js/components/common/ModalRedirect.jsx';
import LoginModalEvents from '../../../../../assets/js/client/LoginModalEvents.js';

describe('ModalRedirect', () => {
  let originalWindow;

  beforeEach(() => {
    originalWindow = globalThis.window;
    globalThis.window = { location: { hash: '#/login' } };
    spyOn(LoginModalEvents, 'open');
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  describe('redirectToModal', () => {
    it('opens the login modal in the given mode', () => {
      redirectToModal('register');

      expect(LoginModalEvents.open).toHaveBeenCalledWith('register');
    });

    it('sends the URL hash back to the home route', () => {
      redirectToModal('password');

      expect(globalThis.window.location.hash).toBe('/');
    });
  });

  describe('component', () => {
    it('renders nothing', () => {
      const markup = renderToStaticMarkup(
        React.createElement('div', null, React.createElement(ModalRedirect, { mode: 'password' })),
      );

      expect(markup).toBe('<div></div>');
    });
  });
});
