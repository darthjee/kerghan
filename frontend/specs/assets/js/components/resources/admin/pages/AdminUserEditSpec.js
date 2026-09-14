import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminUserEdit from '../../../../../../../assets/js/components/resources/admin/pages/AdminUserEdit.jsx';
import AdminUserEditHelper from '../../../../../../../assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx';
import AdminUserEditController from '../../../../../../../assets/js/components/resources/admin/pages/controllers/AdminUserEditController.js';

describe('AdminUserEdit', () => {
  it('passes the default state to the helper', () => {
    spyOn(AdminUserEditHelper, 'render').and.returnValue(React.createElement('div', null, 'admin-user-edit'));

    const html = renderToStaticMarkup(React.createElement(AdminUserEdit));

    expect(html).toContain('admin-user-edit');
    expect(AdminUserEditHelper.render).toHaveBeenCalledWith(
      {
        username: '',
        email: '',
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

  it('delegates submission to the controller with the route user id and current fields, preventing default navigation', async () => {
    spyOn(AdminUserEditController.prototype, 'handleSubmit').and.resolveTo();
    let capturedHandlers;
    spyOn(AdminUserEditHelper, 'render').and.callFake((_state, handlers) => {
      capturedHandlers = handlers;
      return React.createElement('div');
    });

    const fakeWindow = { location: { hash: '#/admin/users/42/edit' } };
    globalThis.window = fakeWindow;

    try {
      renderToStaticMarkup(React.createElement(AdminUserEdit));
      const fakeEvent = { preventDefault: jasmine.createSpy('preventDefault') };
      await capturedHandlers.onSubmit(fakeEvent);

      expect(fakeEvent.preventDefault).toHaveBeenCalled();
      expect(AdminUserEditController.prototype.handleSubmit).toHaveBeenCalledWith('42', {
        username: '',
        email: '',
        newPassword: '',
        newPasswordConfirmation: '',
      });
    } finally {
      delete globalThis.window;
    }
  });

  it('updates a field locally on change, without reaching the controller', () => {
    spyOn(AdminUserEditController.prototype, 'handleSubmit').and.resolveTo();
    let capturedHandlers;
    spyOn(AdminUserEditHelper, 'render').and.callFake((_state, handlers) => {
      capturedHandlers = handlers;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(AdminUserEdit));

    expect(() => capturedHandlers.onChange('username')({ target: { value: 'newname' } }))
      .not.toThrow();
    expect(AdminUserEditController.prototype.handleSubmit).not.toHaveBeenCalled();
  });
});
