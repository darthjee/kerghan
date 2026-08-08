import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Header from '../../../../../../assets/js/components/common/header/Header.jsx';

describe('Header', () => {
  it('renders the navigation bar', () => {
    const markup = renderToStaticMarkup(React.createElement(Header, null));

    expect(markup).toContain('Kerghan');
  });

  it('renders a link to the register page', () => {
    const markup = renderToStaticMarkup(React.createElement(Header, null));

    expect(markup).toContain('href="#/register"');
  });

  it('renders its children', () => {
    const markup = renderToStaticMarkup(
      React.createElement(Header, null, React.createElement('p', null, 'page content')),
    );

    expect(markup).toContain('page content');
  });
});
