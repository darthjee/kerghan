/**
 * Builds the event handlers of the project list, binding controller methods to UI events.
 */
const ProjectsHandlers = {
  /**
   * Build the page's handlers.
   *
   * @param {object} controller - The page's `ProjectsController`.
   * @returns {object} The handlers: search, page and retry.
   */
  build(controller) {
    return {
      onSearchChange: (event) => controller.changeSearch(event.target.value),
      onPageChange: (page) => () => controller.changePage(page),
      onRetry: () => controller.retry(),
    };
  },
};

export default ProjectsHandlers;
