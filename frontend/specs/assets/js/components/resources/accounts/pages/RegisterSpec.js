import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Register from '../../../../../../../assets/js/components/resources/accounts/pages/Register.jsx';
import RegisterHelper from '../../../../../../../assets/js/components/resources/accounts/pages/helpers/RegisterHelper.jsx';

describe('Register', () => {
  it('passes the default state to the helper', () => {
    spyOn(RegisterHelper, 'render').and.returnValue(React.createElement('div', null, 'register'));

    const html = renderToStaticMarkup(React.createElement(Register));

    expect(html).toContain('register');
    expect(RegisterHelper.render).toHaveBeenCalledWith(
      {
        username: '',
        email: '',
        password: '',
        passwordConfirmation: '',
        fieldErrors: {},
        submitError: null,
      },
      jasmine.objectContaining({
        onSubmit: jasmine.any(Function),
        onUsernameChange: jasmine.any(Function),
        onEmailChange: jasmine.any(Function),
        onPasswordChange: jasmine.any(Function),
        onPasswordConfirmationChange: jasmine.any(Function),
      }),
    );
  });
});
