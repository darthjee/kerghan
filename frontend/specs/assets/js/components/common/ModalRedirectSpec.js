import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ModalRedirect, { redirectToModal } from '../../../../../assets/js/components/common/ModalRedirect.jsx';
import LoginModalEvents from '../../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../support/fakeWindow.js';

describe('ModalRedirect', () => {

  beforeEach(() => {
    installFakeWindow({ location: { hash: '#/login' } });
    spyOn(LoginModalEvents, 'open');
  });

  afterEach(() => {
    uninstallFakeWindow();
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
