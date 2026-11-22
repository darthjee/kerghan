import React, { Suspense } from 'react';
import IssueBody from '../../../../../../../assets/js/components/resources/issues/body/IssueBody.jsx';
import IssueBodyPlain from '../../../../../../../assets/js/components/resources/issues/body/IssueBodyPlain.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('IssueBody', () => {
  const render = (body) => renderedOutput(React.createElement(IssueBody, { body }));

  // The Markdown chunk is lazy and, once any spec has loaded it, resolves immediately, so these
  // specs inspect the element tree instead of rendering it: the result never depends on spec order.
  describe('while the Markdown chunk loads (P5)', () => {
    const tree = (body) => IssueBody({ body });

    it('wraps the Markdown renderer in a Suspense', () => {
      expect(tree('# Title').type).toBe(Suspense);
    });

    it('falls back to the body as plain text', () => {
      const { fallback } = tree('# Title <script>').props;

      expect(fallback.type).toBe(IssueBodyPlain);
      expect(fallback.props.body).toBe('# Title <script>');
    });

    it('hands the body to the Markdown renderer', () => {
      expect(tree('# Title').props.children.props.body).toBe('# Title');
    });
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
