import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HeaderHelper from '../../../../../../../assets/js/components/common/header/helpers/HeaderHelper.jsx';

describe('HeaderHelper', () => {
  it('renders the brand link to home', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render()));

    expect(markup).toContain('href="#/"');
  });

  it('renders the register nav link', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render()));

    expect(markup).toContain('href="#/register"');
  });
});
