import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Recover from '../../../../../../../assets/js/components/resources/accounts/pages/Recover.jsx';
import RecoverHelper from '../../../../../../../assets/js/components/resources/accounts/pages/helpers/RecoverHelper.jsx';

describe('Recover', () => {
  it('passes the default state to the helper', () => {
    spyOn(RecoverHelper, 'render').and.returnValue(React.createElement('div', null, 'recover'));

    // eslint-disable-next-line xss/no-mixed-html -- server-side renderToStaticMarkup output in
    // a Node-only spec, no DOM/user input involved; same pattern as RegisterSpec.js.
    const html = renderToStaticMarkup(React.createElement(Recover));

    // eslint-disable-next-line xss/no-mixed-html -- asserting against static test markup only,
    // no DOM/user input involved; same pattern as RegisterSpec.js.
    expect(html).toContain('recover');
    expect(RecoverHelper.render).toHaveBeenCalledWith(
      {
        email: '',
        sent: false,
      },
      jasmine.objectContaining({
        onSubmit: jasmine.any(Function),
        onEmailChange: jasmine.any(Function),
      }),
    );
  });
});
