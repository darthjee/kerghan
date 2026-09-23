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

  it('renders the element once, however many queries are made', () => {
    const output = renderedOutput(React.createElement(Component));

    output.contains('Hello');
    output.contains('Goodbye');
    output.containsTag('p');

    expect(Component).toHaveBeenCalledTimes(1);
  });
});
