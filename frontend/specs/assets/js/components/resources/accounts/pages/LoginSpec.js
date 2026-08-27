import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Login from '../../../../../../../assets/js/components/resources/accounts/pages/Login.jsx';
import LoginHelper from '../../../../../../../assets/js/components/resources/accounts/pages/helpers/LoginHelper.jsx';

describe('Login', () => {
  it('passes the default state to the helper', () => {
    spyOn(LoginHelper, 'render').and.returnValue(React.createElement('div', null, 'login'));

    // eslint-disable-next-line xss/no-mixed-html -- server-side renderToStaticMarkup output in
    // a Node-only spec, no DOM/user input involved; same pattern as RegisterSpec.js.
    const html = renderToStaticMarkup(React.createElement(Login));

    // eslint-disable-next-line xss/no-mixed-html -- asserting against static test markup only,
    // no DOM/user input involved; same pattern as RegisterSpec.js.
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
