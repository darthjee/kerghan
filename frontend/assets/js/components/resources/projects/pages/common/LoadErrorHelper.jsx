/**
 * Rendering helper of the load-error alert with its Retry action.
 */
const LoadErrorHelper = {
  /**
   * Render a danger alert with the message and a Retry button.
   *
   * @param {string} error - The load error message.
   * @param {Function} onRetry - Click handler of Retry.
   * @returns {React.ReactElement} The alert.
   */
  render(error, onRetry) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
          <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={onRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  },
};

export default LoadErrorHelper;
