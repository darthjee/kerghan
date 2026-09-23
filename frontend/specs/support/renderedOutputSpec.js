import React from 'react';
import { renderedOutput } from './renderedOutput.js';

describe('renderedOutput', () => {
  let Component;

  beforeEach(() => {
    Component = jasmine.createSpy('Component').and.callFake(
      () => React.createElement('p', { className: 'greeting' }, 'Hello'),
    );
  });

  describe('#contains', () => {
    it('is true for text present in the rendered output', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.contains('class="greeting">Hello')).toBeTrue();
    });

    it('is false for text absent from the rendered output', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.contains('Goodbye')).toBeFalse();
    });
  });

  describe('#containsTag', () => {
    it('is true for a tag present in the rendered output', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsTag('p')).toBeTrue();
    });

    it('is false for a tag absent from the rendered output', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsTag('form')).toBeFalse();
    });
  });

  describe('#containsElement', () => {
    it('is true for text that is the full content of the named element', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsElement('p', 'Hello')).toBeTrue();
    });

    it('is false for text absent from the rendered output', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsElement('p', 'Goodbye')).toBeFalse();
    });

    it('is false for the same text under a different tag', () => {
      const output = renderedOutput(React.createElement(Component));

      expect(output.containsElement('span', 'Hello')).toBeFalse();
    });
  });

  it('renders the element once, however many queries are made', () => {
    const output = renderedOutput(React.createElement(Component));

    output.contains('Hello');
    output.contains('Goodbye');
    output.containsTag('p');
    output.containsElement('p', 'Hello');

    expect(Component).toHaveBeenCalledTimes(1);
  });
});
