/**
 * Builds the event handlers of the Repositories page, binding controller methods to UI events.
 */
const RepositoriesHandlers = {
  /**
   * Build the page's handlers.
   *
   * @param {object} controller - The page's `RepositoriesController`.
   * @returns {object} The handlers: filter, search, page, refresh, add, dismiss and retry.
   */
  build(controller) {
    return {
      onFilterChange: (event) => controller.changeFilter(event.target.value),
      onSearchChange: (event) => controller.changeSearch(event.target.value),
      onPageChange: (page) => () => controller.changePage(page),
      onRefresh: () => controller.refresh(),
      onAdd: (githubId) => () => controller.add(githubId),
      onDismiss: (source) => () => controller.dismiss(source),
      onRetry: () => controller.retry(),
    };
  },
};

export default RepositoriesHandlers;
