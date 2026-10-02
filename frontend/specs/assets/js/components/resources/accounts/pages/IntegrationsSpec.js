import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Integrations from '../../../../../../../assets/js/components/resources/accounts/pages/Integrations.jsx';

describe('Integrations', () => {
  it('renders the Integrations heading', () => {
    expect(renderToStaticMarkup(React.createElement(Integrations))).toContain('<h1>Integrations</h1>');
  });
});
