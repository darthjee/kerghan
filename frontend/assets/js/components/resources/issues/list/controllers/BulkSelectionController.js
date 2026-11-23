import IssuesClient from '../../../../../client/IssuesClient.js';
import RateLimitCountdownController from '../../../../common/forms/RateLimitCountdownController.js';
import ProjectErrorMessages from '../../../projects/errors/errorMessages.js';

const IDLE_COUNTDOWN = { active: false, secondsLeft: 0, label: null };

/** The initial bulk state: nothing selected, nothing in flight, no notice or error. */
export const INITIAL_BULK = {
  selected: [], inFlight: false, notice: null, error: null, countdown: IDLE_COUNTDOWN,
};

/**
 * Build the summary notice of a bulk call from its `200` answer.
 *
 * @param {{state: string, changed: Array<string>, unchanged: Array<string>,
 *   notFound: Array<string>}} result - The answer.
 * @returns {string} "Closed N issues" (or "Reopened N issues"), then "M were already closed"
 *   (or "open") when some issues were already in the state, then "K were no longer found" when
 *   some vanished.
 */
export function buildNotice({ state, changed, unchanged, notFound }) {
  const closing = state === 'closed';
  const parts = [`${closing ? 'Closed' : 'Reopened'} ${changed.length} issues`];

  if (unchanged.length > 0) {
    parts.push(`${unchanged.length} were already ${closing ? 'closed' : 'open'}`);
  }

  if (notFound.length > 0) {
    parts.push(`${notFound.length} were no longer found`);
  }

  return `${parts.join('. ')}.`;
}

/**
 * Controller of the issue list's bulk selection and its Close / Reopen call.
 *
 * @description The selection is a set of issue ids of the current page, held in memory only. It
 * is cleared by {@link BulkSelectionController#clear} on every page, filter or search change.
 * {@link BulkSelectionController#apply} sends the selection in one call, shows the summary
 * notice, clears the selection and re-reads the list once. A `429 ISSUE_EDIT_RATE_LIMITED`
 * (nothing was applied) keeps the selection and counts down the wait without resubmitting. An
 * `undefined` answer (session expired, the login modal is open) changes nothing.
 */
export default class BulkSelectionController {
  #setBulk;

  #projectId;

  #reload;

  #client;

  #countdownFactory;

  #state = { ...INITIAL_BULK };

  #countdown = null;

  /**
   * Create the controller.
   *
   * @param {{setBulk: Function}} setters - React state setter of the
   *   `{selected, inFlight, notice, error, countdown}` bulk state.
   * @param {string} projectId - The project's uuid.
   * @param {{reload: Function}} list - The list: `reload` re-reads its current page.
   * @param {typeof IssuesClient} [client] - Issues HTTP client override, for testability.
   * @param {Function} [countdownFactory] - Builds a `RateLimitCountdownController` from the
   *   seconds and the change callback, for testability.
   */
  constructor(
    { setBulk }, projectId, { reload }, client = IssuesClient,
    countdownFactory = (seconds, onChange) => new RateLimitCountdownController(seconds, onChange),
  ) {
    this.#setBulk = setBulk;
    this.#projectId = projectId;
    this.#reload = reload;
    this.#client = client;
    this.#countdownFactory = countdownFactory;
  }

  /**
   * Check or uncheck one issue.
   *
   * @param {string} issueId - The issue's uuid.
   * @returns {void} Nothing.
   */
  toggle(issueId) {
    const selected = new Set(this.#state.selected);

    if (!selected.delete(issueId)) {
      selected.add(issueId);
    }

    this.#update({ selected: [...selected] });
  }

  /**
   * Check every row of the page, or uncheck them all when all are already checked.
   *
   * @param {Array<string>} pageIds - The uuids of the page's rows.
   * @returns {void} Nothing.
   */
  toggleAll(pageIds) {
    const allChecked = pageIds.length > 0 && pageIds.every((id) => this.#state.selected.includes(id));

    this.#update({ selected: allChecked ? [] : [...pageIds] });
  }

  /**
   * Forget the selection and the last notice or error (page, filter or search change).
   *
   * @returns {void} Nothing.
   */
  clear() {
    this.#update({ selected: [], notice: null, error: null });
  }

  /**
   * Close or reopen the selected issues in one call.
   *
   * @param {string} state - `closed` (Close selected) or `open` (Reopen selected).
   * @returns {Promise<void>} Resolves once the call (and the re-read) settled. Ignored while a
   *   call is in flight, while a rate-limit wait is on, or with nothing selected.
   */
  async apply(state) {
    const { selected, inFlight, countdown } = this.#state;

    if (inFlight || countdown.active || selected.length === 0) {
      return;
    }

    this.#update({ inFlight: true, notice: null, error: null });

    try {
      const result = await this.#client.bulkState(this.#projectId, { issueIds: [...selected], state });

      await this.#succeed(result);
    } catch (error) {
      await this.#fail(error);
    }
  }

  /**
   * Stop the rate-limit countdown (unmount).
   *
   * @returns {void} Nothing.
   */
  dispose() {
    this.#countdown?.dispose();
    this.#countdown = null;
  }

  async #succeed(result) {
    if (result === undefined) {
      this.#update({ inFlight: false });
      return;
    }

    this.#update({ inFlight: false, selected: [], notice: buildNotice(result) });
    await this.#reload();
  }

  async #fail(error) {
    this.#update({ inFlight: false });

    if (ProjectErrorMessages.isIssueNotFound(error)) {
      await this.#reload();
      return;
    }

    const described = ProjectErrorMessages.describe(error);

    this.#update({ error: described });

    if (ProjectErrorMessages.isRateLimit(error)) {
      this.#startCountdown(described.retryAfterSeconds);
    }
  }

  #startCountdown(seconds) {
    this.#countdown?.dispose();
    this.#countdown = this.#countdownFactory(seconds, (countdown) => this.#update({ countdown }));
    this.#update({ countdown: this.#countdown.state });
  }

  #update(changes) {
    this.#state = { ...this.#state, ...changes };
    this.#setBulk(this.#state);
  }
}
