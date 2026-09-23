import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Renders a React element once and answers questions about the rendered output.
 *
 * @description Renders `element` with `renderToStaticMarkup` a single time and keeps the result
 * private, exposing only boolean queries so specs assert on booleans instead of passing the
 * rendered string around.
 * @param {React.ReactElement} element - The element to render.
 * @returns {{contains: Function}} An object whose `contains(text)` tells whether the rendered
 *   output includes `text`.
 */
export const renderedOutput = (element) => {
  const renderedHtml = renderToStaticMarkup(element);

  return {
    contains: (text) => renderedHtml.includes(text),
  };
};
