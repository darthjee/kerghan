let recorded = null;

/**
 * One-shot, in-memory signal that an issue was just saved on the edit form, so the issue page
 * starts the bounded re-read. Nothing goes to the URL or to storage (S4).
 */
const SavedIssueSignal = {
  /**
   * Record that an issue was saved.
   *
   * @param {string} issueId - The saved issue's id.
   * @param {object} issue - The issue the save answered.
   * @returns {void} Nothing.
   */
  record(issueId, issue) {
    recorded = { issueId, issue };
  },

  /**
   * Take the recorded issue, once.
   *
   * @description Clears the signal whether or not the id matched, so a stale record never
   * survives a navigation.
   * @param {string} issueId - The id of the issue page asking.
   * @returns {object|undefined} The saved issue when the id matches, else `undefined`.
   */
  consume(issueId) {
    const current = recorded;

    recorded = null;

    return current?.issueId === issueId ? current.issue : undefined;
  },
};

export default SavedIssueSignal;
