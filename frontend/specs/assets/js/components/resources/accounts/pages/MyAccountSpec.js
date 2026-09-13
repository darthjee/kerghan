import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MyAccount from '../../../../../../../assets/js/components/resources/accounts/pages/MyAccount.jsx';
import MyAccountHelper from '../../../../../../../assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx';
import MyAccountController from '../../../../../../../assets/js/components/resources/accounts/pages/controllers/MyAccountController.js';

describe('MyAccount', () => {
  it('passes the default state to the helper', () => {
    spyOn(MyAccountHelper, 'render').and.returnValue(React.createElement('div', null, 'my-account'));

    const html = renderToStaticMarkup(React.createElement(MyAccount));

    expect(html).toContain('my-account');
    expect(MyAccountHelper.render).toHaveBeenCalledWith(
      {
        username: '',
        email: '',
        currentPassword: '',
        newPassword: '',
        newPasswordConfirmation: '',
        fieldErrors: {},
        submitError: null,
        success: false,
      },
      jasmine.objectContaining({
        onSubmit: jasmine.any(Function),
        onChange: jasmine.any(Function),
      }),
    );
  });

  it('delegates submission to the controller with the current fields, preventing default navigation', async () => {
    spyOn(MyAccountController.prototype, 'handleSubmit').and.resolveTo();
    let capturedHandlers;
    spyOn(MyAccountHelper, 'render').and.callFake((_state, handlers) => {
      capturedHandlers = handlers;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(MyAccount));
    const fakeEvent = { preventDefault: jasmine.createSpy('preventDefault') };
    await capturedHandlers.onSubmit(fakeEvent);

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(MyAccountController.prototype.handleSubmit).toHaveBeenCalledWith({
      username: '',
      email: '',
      currentPassword: '',
      newPassword: '',
      newPasswordConfirmation: '',
    });
  });

  it('updates a field locally on change, without reaching the controller', () => {
    spyOn(MyAccountController.prototype, 'handleSubmit').and.resolveTo();
    let capturedHandlers;
    spyOn(MyAccountHelper, 'render').and.callFake((_state, handlers) => {
      capturedHandlers = handlers;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(MyAccount));

    expect(() => capturedHandlers.onChange('username')({ target: { value: 'newname' } }))
      .not.toThrow();
    expect(MyAccountController.prototype.handleSubmit).not.toHaveBeenCalled();
  });
});
