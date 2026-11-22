import React from 'react';
import IssueBodyPlain from '../../../../../../../assets/js/components/resources/issues/body/IssueBodyPlain.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('IssueBodyPlain', () => {
  const render = (body) => renderedOutput(React.createElement(IssueBodyPlain, { body }));

  it('shows the body escaped in a pre, never interpreted', () => {
    const rendered = render('# Title <script>');

    expect(rendered.containsTag('pre')).toBeTrue();
    expect(rendered.contains('# Title &lt;script&gt;')).toBeTrue();
    expect(rendered.containsTag('h1')).toBeFalse();
    expect(rendered.containsTag('script')).toBeFalse();
  });
});
