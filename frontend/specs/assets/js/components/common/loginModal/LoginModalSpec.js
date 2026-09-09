import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginModal from '../../../../../../assets/js/components/common/loginModal/LoginModal.jsx';
import LoginModalHelper from '../../../../../../assets/js/components/common/loginModal/helpers/LoginModalHelper.jsx';
import LoginModalController from '../../../../../../assets/js/components/common/loginModal/controllers/LoginModalController.js';
import LoginModalEvents from '../../../../../../assets/js/client/LoginModalEvents.js';

describe('LoginModal', () => {
  let lastState;
  let lastHandlers;

  const render = () => {
    spyOn(LoginModalHelper, 'render').and.callFake((state, handlers) => {
      lastState = state;
      lastHandlers = handlers;
      return React.createElement('div', null, 'login-modal');
    });

    return renderToStaticMarkup(React.createElement(LoginModal));
  };

  it('passes the default state to the helper', () => {
    const html = render();

    expect(html).toContain('login-modal');
    expect(lastState).toEqual({
      username: '',
      email: '',
      password: '',
      passwordConfirmation: '',
      open: false,
      mode: 'password',
      fieldErrors: {},
      submitError: null,
    });
  });

  it('passes a full set of handlers to the helper', () => {
    render();

    expect(lastHandlers).toEqual(jasmine.objectContaining({
      onClose: jasmine.any(Function),
      onSelectMode: jasmine.any(Function),
      onSubmit: jasmine.any(Function),
      onUsernameChange: jasmine.any(Function),
      onEmailChange: jasmine.any(Function),
      onPasswordChange: jasmine.any(Function),
      onPasswordConfirmationChange: jasmine.any(Function),
    }));
  });

  it('submits through the controller for the active mode and prevents the default', () => {
    spyOn(LoginModalController.prototype, 'handleSubmit').and.resolveTo();
    render();
    const event = { preventDefault: jasmine.createSpy('preventDefault') };

    lastHandlers.onSubmit(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(LoginModalController.prototype.handleSubmit).toHaveBeenCalledWith('password', {
      username: '', email: '', password: '', passwordConfirmation: '',
    });
  });

  it('switches mode through the controller', () => {
    spyOn(LoginModalController.prototype, 'switchMode');
    render();

    lastHandlers.onSelectMode('register');

    expect(LoginModalController.prototype.switchMode).toHaveBeenCalledWith('register');
  });

  it('closes via the shared LoginModalEvents bus', () => {
    spyOn(LoginModalEvents, 'close');
    render();

    lastHandlers.onClose();

    expect(LoginModalEvents.close).toHaveBeenCalled();
  });
});
