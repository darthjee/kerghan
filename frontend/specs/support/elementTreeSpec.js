import React from 'react';
import { findButton, findElements } from './elementTree.js';

describe('elementTree support', () => {
  const tree = React.createElement(
    'div',
    null,
    [
      React.createElement('button', { key: 'a', id: 'a' }, 'Save'),
      'text',
      null,
      React.createElement('span', { key: 'b' }, React.createElement('button', { id: 'b' }, 'Cancel')),
    ],
  );

  it('finds every matching element, depth-first', () => {
    expect(findElements(tree, (node) => node.type === 'button').map((node) => node.props.id)).toEqual(['a', 'b']);
  });

  it('finds a button by its text', () => {
    expect(findButton(tree, 'Cancel').props.id).toBe('b');
  });

  it('returns undefined for a missing button', () => {
    expect(findButton(tree, 'Missing')).toBeUndefined();
  });
});
