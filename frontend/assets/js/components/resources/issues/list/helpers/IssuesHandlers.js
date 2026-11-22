/**
 * Builds the event handlers of the issue list, binding controller methods to UI events.
 */
const IssuesHandlers = {
  /**
   * Build the list's handlers.
   *
   * @param {object} controller - The list's `IssuesController`.
   * @returns {object} The handlers: search, state, page and retry.
   */
  build(controller) {
    return {
      onSearchChange: (event) => controller.changeSearch(event.target.value),
      onStateChange: (event) => controller.changeState(event.target.value),
      onPageChange: (page) => () => controller.changePage(page),
      onRetry: () => controller.retry(),
    };
  },
};

export default IssuesHandlers;
