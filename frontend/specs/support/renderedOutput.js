import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Renders a React element once and answers questions about the rendered output.
 *
 * @description Renders `element` with `renderToStaticMarkup` a single time and keeps the result
 * private, exposing only boolean queries so specs assert on booleans instead of passing the
 * rendered string around. `containsTag` lets specs check for an element without passing markup
 * literals around, `containsElement` checks an element's full text content the same way, and
 * `containsAttribute` checks for an exact `name="value"` attribute pair.
 * @param {React.ReactElement} element - The element to render.
 * @returns {{contains: Function, containsTag: Function, containsElement: Function,
 *   containsAttribute: Function}} An object
 *   whose `contains(text)` tells whether the rendered output includes `text`, whose
 *   `containsTag(tagName)` tells whether it includes an opening tag named `tagName`, and whose
 *   `containsElement(tagName, text)` tells whether `text` is the full content of an element
 *   named `tagName`, and whose `containsAttribute(name, value)` tells whether it includes an
 *   attribute `name` whose value is exactly `value`.
 */
export const renderedOutput = (element) => {
  const rendered = renderToStaticMarkup(element);

  return {
    contains: (text) => rendered.includes(text),
    containsTag: (tagName) => rendered.includes(`<${tagName}`),
    containsElement: (tagName, text) => rendered.includes(`>${text}</${tagName}`),
    containsAttribute: (name, value) => rendered.includes(`${name}="${value}"`),
  };
};
