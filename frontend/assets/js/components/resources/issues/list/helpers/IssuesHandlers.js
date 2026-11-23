/**
 * Builds the event handlers of the issue list, binding controller methods to UI events.
 */
const IssuesHandlers = {
  /**
   * Build the list's handlers.
   *
   * @param {object} controller - The list's `IssuesController`.
   * @param {object} [bulkController] - The list's `BulkSelectionController`.
   * @returns {object} The handlers: search, state, page, retry, and the bulk selection ones
   *   (`onToggle`, `onToggleAll`, `onBulkClose`, `onBulkReopen`, `onDismissNotice`).
   */
  build(controller, bulkController) {
    return {
      onSearchChange: (event) => controller.changeSearch(event.target.value),
      onStateChange: (event) => controller.changeState(event.target.value),
      onPageChange: (page) => () => controller.changePage(page),
      onRetry: () => controller.retry(),
      onToggle: (issueId) => bulkController.toggle(issueId),
      onToggleAll: (pageIds) => bulkController.toggleAll(pageIds),
      onBulkClose: () => bulkController.apply('closed'),
      onBulkReopen: () => bulkController.apply('open'),
      onDismissNotice: () => bulkController.dismissNotice(),
    };
  },
};

export default IssuesHandlers;
