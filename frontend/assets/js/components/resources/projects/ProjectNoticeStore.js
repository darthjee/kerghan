let messages = null;

/**
 * One-time notice carried in memory from the project deletion to the project list (not in the
 * URL, so a reload does not repeat it).
 */
const ProjectNoticeStore = {
  /**
   * Record the notice of a deleted project.
   *
   * @param {number} [unsentIssueCount] - How many issues had changes that were not sent to
   *   GitHub; mentioned only when above 0.
   * @returns {void} Nothing.
   */
  setDeleted(unsentIssueCount = 0) {
    messages = ['Project deleted.'];

    if (unsentIssueCount > 0) {
      const noun = unsentIssueCount === 1 ? 'issue had' : 'issues had';

      messages.push(`${unsentIssueCount} ${noun} changes that were not sent to GitHub.`);
    }
  },

  /**
   * Take the notice, clearing it so it shows once.
   *
   * @returns {(string[]|null)} The notice's lines, or `null` when there is none.
   */
  take() {
    const taken = messages;

    messages = null;
    return taken;
  },
};

export default ProjectNoticeStore;
