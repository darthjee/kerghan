/**
 * Rendering helper of the "not found" views (U1): a missing, deleted or foreign project or
 * issue all look the same.
 */
const NotFoundHelper = {
  /**
   * Render a not-found view.
   *
   * @param {string} message - What was not found (e.g. `Project not found`).
   * @param {{href: string, text: string}} back - Where to go instead.
   * @returns {React.ReactElement} The view, with a link back.
   */
  render(message, back) {
    return (
      <div className="container mt-4">
        <h1 className="h3">{message}</h1>
        <a href={back.href}>{back.text}</a>
      </div>
    );
  },
};

export default NotFoundHelper;
