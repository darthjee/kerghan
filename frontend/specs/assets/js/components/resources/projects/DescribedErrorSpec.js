import React from 'react';
import DescribedError from '../../../../../../assets/js/components/resources/projects/DescribedError.jsx';
import { renderedOutput } from '../../../../../support/renderedOutput.js';

describe('DescribedError', () => {
  const outputOf = (props) => renderedOutput(React.createElement(DescribedError, props));

  it('renders the message with the given class and role', () => {
    const output = outputOf({ error: { message: 'Nope' }, className: 'alert alert-danger', role: 'alert' });

    expect(output.contains('Nope')).toBe(true);
    expect(output.containsAttribute('class', 'alert alert-danger')).toBe(true);
    expect(output.containsAttribute('role', 'alert')).toBe(true);
  });

  it('renders the link when there is one', () => {
    const output = outputOf({
      error: { message: 'Taken', link: { href: '#/projects/abc', text: 'Open the existing project' } },
    });

    expect(output.containsAttribute('href', '#/projects/abc')).toBe(true);
    expect(output.containsElement('a', 'Open the existing project')).toBe(true);
  });

  it('lists the details when there are some', () => {
    const output = outputOf({ error: { message: 'Bad', details: ['name must not be empty', 'x'] } });

    expect(output.containsElement('li', 'name must not be empty')).toBe(true);
    expect(output.containsElement('li', 'x')).toBe(true);
  });

  it('renders no list without details, and no link without one', () => {
    const output = outputOf({ error: { message: 'Bad', details: [] } });

    expect(output.containsTag('ul')).toBe(false);
    expect(output.containsTag('a')).toBe(false);
  });

  it('renders markup in a message as text (S1)', () => {
    const output = outputOf({ error: { message: '<img src=x>' } });

    expect(output.contains('<img')).toBe(false);
    expect(output.contains('&lt;img src=x&gt;')).toBe(true);
  });
});
