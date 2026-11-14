import Pagination from 'react-bootstrap/cjs/Pagination.js';

const WINDOW = 2;

/**
 * List the page numbers shown around the current page.
 *
 * @param {number} page - The current page.
 * @param {number} totalPages - The number of pages.
 * @returns {Array<number>} The page numbers.
 */
function pageNumbers(page, totalPages) {
  const first = Math.max(1, page - WINDOW);
  const last = Math.min(totalPages, page + WINDOW);

  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

/**
 * Rendering helper for the listing's pagination controls.
 */
const RepositoriesPaginationHelper = {
  /**
   * Render the pagination controls.
   *
   * @param {{page: number, totalPages: number}} pagination - The listing's pagination.
   * @param {{onPageChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement|null} The controls, or `null` for a single page.
   */
  render(pagination, handlers) {
    const { page, totalPages } = pagination;

    if (totalPages <= 1) {
      return null;
    }

    return (
      <Pagination>
        <Pagination.Prev disabled={page <= 1} onClick={handlers.onPageChange(page - 1)} />
        {pageNumbers(page, totalPages).map((number) => (
          <Pagination.Item key={number} active={number === page} onClick={handlers.onPageChange(number)}>
            {number}
          </Pagination.Item>
        ))}
        <Pagination.Next disabled={page >= totalPages} onClick={handlers.onPageChange(page + 1)} />
      </Pagination>
    );
  },
};

export default RepositoriesPaginationHelper;
