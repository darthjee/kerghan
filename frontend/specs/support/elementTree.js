/**
 * Collect every React element in a rendered tree (following `props.children`) matching a
 * predicate, depth-first. Only works on trees whose helpers call each other directly (no
 * function components to render), as the Integrations helpers do.
 *
 * @param {*} node - The tree (element, array, string, or nullish).
 * @param {Function} predicate - Called with each element.
 * @param {Array} [acc] - Accumulator.
 * @returns {Array<object>} The matching elements.
 */
export function findElements(node, predicate, acc = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => findElements(child, predicate, acc));
    return acc;
  }

  if (!node || typeof node !== 'object') {
    return acc;
  }

  if (predicate(node)) {
    acc.push(node);
  }

  return findElements(node.props?.children, predicate, acc);
}

/**
 * Find the first button whose text is exactly `label`.
 *
 * @param {*} tree - The rendered tree.
 * @param {string} label - The button text.
 * @returns {object|undefined} The button element.
 */
export function findButton(tree, label) {
  return findElements(tree, (node) => node.type === 'button' && node.props.children === label)[0];
}
