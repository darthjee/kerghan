import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Login from '../../../../../../../assets/js/components/resources/accounts/pages/Login.jsx';
import LoginHelper from '../../../../../../../assets/js/components/resources/accounts/pages/helpers/LoginHelper.jsx';

describe('Login', () => {
  it('passes the default state to the helper', () => {
    spyOn(LoginHelper, 'render').and.returnValue(React.createElement('div', null, 'login'));

    const html = renderToStaticMarkup(React.createElement(Login));

    expect(html).toContain('login');
    expect(LoginHelper.render).toHaveBeenCalledWith(
      {
        username: '',
        password: '',
        submitError: null,
      },
      jasmine.objectContaining({
        onSubmit: jasmine.any(Function),
        onUsernameChange: jasmine.any(Function),
        onPasswordChange: jasmine.any(Function),
      }),
    );
  });
});
