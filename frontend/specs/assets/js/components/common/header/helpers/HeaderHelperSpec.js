import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HeaderHelper from '../../../../../../../assets/js/components/common/header/helpers/HeaderHelper.jsx';

describe('HeaderHelper', () => {
  const onLogout = jasmine.createSpy('onLogout');

  it('renders the brand link to home', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, onLogout)));

    expect(markup).toContain('href="#/"');
  });

  it('renders the register nav link', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, onLogout)));

    expect(markup).toContain('href="#/register"');
  });

  it('renders a Login link when logged out', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, onLogout)));

    expect(markup).toContain('href="#/login"');
    expect(markup).toContain('Login');
  });

  it('renders a Logout link when logged in', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(true, onLogout)));

    expect(markup).toContain('Logout');
    expect(markup).not.toContain('href="#/login"');
  });
});
