import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ResetPassword from '../../../../../../../assets/js/components/resources/accounts/pages/ResetPassword.jsx';
import ResetPasswordHelper from '../../../../../../../assets/js/components/resources/accounts/pages/helpers/ResetPasswordHelper.jsx';
import ResetPasswordController from '../../../../../../../assets/js/components/resources/accounts/pages/controllers/ResetPasswordController.js';

describe('ResetPassword', () => {
  it('passes the default state to the helper', () => {
    spyOn(ResetPasswordHelper, 'render').and.returnValue(React.createElement('div', null, 'reset-password'));

    const html = renderToStaticMarkup(React.createElement(ResetPassword));

    expect(html).toContain('reset-password');
    expect(ResetPasswordHelper.render).toHaveBeenCalledWith(
      {
        password: '',
        passwordConfirmation: '',
        fieldErrors: {},
        submitError: null,
        resetDone: false,
      },
      jasmine.objectContaining({
        onSubmit: jasmine.any(Function),
        onPasswordChange: jasmine.any(Function),
        onPasswordConfirmationChange: jasmine.any(Function),
      }),
    );
  });

  it('extracts the token from the current hash query string and forwards it on submit', async () => {
    spyOn(ResetPasswordController.prototype, 'handleSubmit').and.resolveTo();
    let capturedHandlers;
    spyOn(ResetPasswordHelper, 'render').and.callFake((_state, handlers) => {
      capturedHandlers = handlers;
      return React.createElement('div');
    });
    const fakeWindow = { location: { hash: '#/recover-password?token=abc123' } };

    globalThis.window = fakeWindow;

    try {
      renderToStaticMarkup(React.createElement(ResetPassword));
      const fakeEvent = { preventDefault: jasmine.createSpy('preventDefault') };

      await capturedHandlers.onSubmit(fakeEvent);

      expect(fakeEvent.preventDefault).toHaveBeenCalled();
      expect(ResetPasswordController.prototype.handleSubmit).toHaveBeenCalledWith(
        'abc123',
        { password: '', passwordConfirmation: '' },
      );
    } finally {
      delete globalThis.window;
    }
  });

  it('forwards a null token when the hash has no token query param', async () => {
    spyOn(ResetPasswordController.prototype, 'handleSubmit').and.resolveTo();
    let capturedHandlers;
    spyOn(ResetPasswordHelper, 'render').and.callFake((_state, handlers) => {
      capturedHandlers = handlers;
      return React.createElement('div');
    });
    const fakeWindow = { location: { hash: '#/recover-password' } };

    globalThis.window = fakeWindow;

    try {
      renderToStaticMarkup(React.createElement(ResetPassword));
      const fakeEvent = { preventDefault: jasmine.createSpy('preventDefault') };

      await capturedHandlers.onSubmit(fakeEvent);

      expect(ResetPasswordController.prototype.handleSubmit).toHaveBeenCalledWith(
        null,
        { password: '', passwordConfirmation: '' },
      );
    } finally {
      delete globalThis.window;
    }
  });
});
