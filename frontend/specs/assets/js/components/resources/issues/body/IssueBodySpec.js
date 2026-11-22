import React from 'react';
import IssueBody from '../../../../../../../assets/js/components/resources/issues/body/IssueBody.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('IssueBody', () => {
  const render = (body) => renderedOutput(React.createElement(IssueBody, { body }));

  it('shows the body as plain text in a pre while the Markdown chunk loads (P5)', () => {
    const rendered = render('# Title <script>');

    expect(rendered.containsTag('pre')).toBeTrue();
    expect(rendered.contains('# Title &lt;script&gt;')).toBeTrue();
    expect(rendered.containsTag('h1')).toBeFalse();
  });

  [null, undefined, ''].forEach((body) => {
    it(`shows a muted "No description." for ${JSON.stringify(body)}`, () => {
      const rendered = render(body);

      expect(rendered.containsElement('p', 'No description.')).toBeTrue();
      expect(rendered.containsAttribute('class', 'text-muted')).toBeTrue();
      expect(rendered.containsTag('pre')).toBeFalse();
    });
  });
});
