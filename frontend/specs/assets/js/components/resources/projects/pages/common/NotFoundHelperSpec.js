import React from 'react';
import NotFoundHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/NotFoundHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('NotFoundHelper', () => {
  const output = renderedOutput(React.createElement('div', null, NotFoundHelper.render(
    'Project not found', { href: '#/projects', text: 'Back to projects' },
  )));

  it('shows the message', () => {
    expect(output.containsElement('h1', 'Project not found')).toBe(true);
  });

  it('links back', () => {
    expect(output.containsAttribute('href', '#/projects')).toBe(true);
    expect(output.containsElement('a', 'Back to projects')).toBe(true);
  });
});
