import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Renders a React element once and answers questions about the rendered output.
 *
 * @description Renders `element` with `renderToStaticMarkup` a single time and keeps the result
 * private, exposing only boolean queries so specs assert on booleans instead of passing the
 * rendered string around. `containsTag` lets specs check for an element without passing markup
 * literals around.
 * @param {React.ReactElement} element - The element to render.
 * @returns {{contains: Function, containsTag: Function}} An object whose `contains(text)` tells
 *   whether the rendered output includes `text`, and whose `containsTag(tagName)` tells whether
 *   it includes an opening tag named `tagName`.
 */
export const renderedOutput = (element) => {
  const rendered = renderToStaticMarkup(element);

  return {
    contains: (text) => rendered.includes(text),
    containsTag: (tagName) => rendered.includes(`<${tagName}`),
  };
};
