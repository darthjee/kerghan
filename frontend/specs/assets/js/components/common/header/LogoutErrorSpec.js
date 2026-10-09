import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LogoutError from '../../../../../../assets/js/components/common/header/LogoutError.jsx';

describe('LogoutError', () => {
  const markupOf = (message) => renderToStaticMarkup(React.createElement(LogoutError, { message }));

  it('renders nothing when there is no message', () => {
    expect(markupOf(null)).toBe('');
  });

  it('renders nothing when the message is empty', () => {
    expect(markupOf('')).toBe('');
  });

  it('renders the message in a danger alert', () => {
    const markup = markupOf('Could not sign out, please try again.');

    expect(markup).toContain('Could not sign out, please try again.');
    expect(markup).toContain('alert-danger');
    expect(markup).toContain('role="alert"');
  });
});
