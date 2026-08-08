import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../../../assets/js/App.jsx';

describe('App', () => {
  it('renders the header', () => {
    const markup = renderToStaticMarkup(React.createElement(App));

    expect(markup).toContain('Kerghan');
  });

  it('renders the home page by default', () => {
    const markup = renderToStaticMarkup(React.createElement(App));

    expect(markup).not.toContain('<h1>Register</h1>');
  });
});
