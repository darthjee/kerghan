import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AppHelper from '../../../../../assets/js/components/helpers/AppHelper.jsx';

describe('AppHelper', () => {
  it('renders the register page for the register key', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, AppHelper.render('register')));

    expect(markup).toContain('Register');
  });

  it('renders the home page for the home key', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, AppHelper.render('home')));

    expect(markup).toContain('Kerghan');
  });

  it('falls back to the home page for an unknown key', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, AppHelper.render('unknown')));

    expect(markup).toContain('Kerghan');
  });

  it('always renders the header', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, AppHelper.render('home')));

    expect(markup).toContain('navbar');
  });
});
