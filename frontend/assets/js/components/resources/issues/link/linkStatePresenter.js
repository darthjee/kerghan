import { FAILURE_MESSAGES } from './failureReasons.js';
import RelativeTime from './relativeTime.js';

const REPOSITORIES_LINK = { href: '#/repositories', text: 'Open repositories' };
const LOCAL_EDITS = 'This issue stays in Kerghan; edits stay local.';

/**
 * The message of a rate-limited link: the reset time in local time and relative, or the
 * "resume shortly" sentence when it is unknown or past (U7).
 *
 * @param {{rateLimitedUntil: (string|null)}} link - The link.
 * @param {number} now - Current epoch milliseconds.
 * @returns {{text: string}} The message.
 */
function rateLimitedMessage(link, now) {
  const until = link.rateLimitedUntil ? Date.parse(link.rateLimitedUntil) : Number.NaN;

  if (Number.isNaN(until) || until <= now) {
    return { text: 'GitHub\'s rate limit was reached. Sync should resume shortly.' };
  }

  return {
    text: `GitHub's rate limit was reached; sync resumes at ${RelativeTime.clock(until)} (in ${RelativeTime.minutesUntil(until, now)} min).`,
  };
}

/**
 * Messages by `state` or `state/reason`; each builds `{text, link?}` from `(link, now)`.
 *
 * @type {Map<string, Function>}
 */
const MESSAGES = new Map([
  ['linked', (link) => ({ text: `Linked to GitHub #${link.number}` })],
  ['pending', () => ({ text: 'Changes are waiting to be sent to GitHub.' })],
  ['rate_limited', rateLimitedMessage],
  ['repository_unavailable', () => ({
    text: 'This project\'s repository is unavailable, so sync is paused.',
    link: { ...REPOSITORIES_LINK },
  })],
  ['sync_failed', () => ({ text: 'Sync failed after several attempts.' })],
  ['sync_failed/retries_exhausted', () => ({ text: 'Sync failed after several attempts.' })],
  ...FAILURE_MESSAGES,
  ['gone', () => ({ text: `The GitHub issue is no longer available. ${LOCAL_EDITS}` })],
  ['gone/deleted', () => ({ text: `The GitHub issue was deleted. ${LOCAL_EDITS}` })],
  ['gone/moved', () => ({ text: `The GitHub issue was moved to another repository. ${LOCAL_EDITS}` })],
]);

/**
 * The message of one state of a link.
 *
 * @param {string} state - One of the link's `states`.
 * @param {object} link - The link (its `reason` belongs to `gone` and `sync_failed`).
 * @param {number} now - Current epoch milliseconds.
 * @returns {{text: string, link: ({href: string, text: string}|undefined)}} The message.
 */
function messageOf(state, link, now) {
  const keyed = MESSAGES.get(`${state}/${link.reason}`);
  const build = keyed ?? MESSAGES.get(state);

  return build ? build(link, now) : { text: '' };
}

/**
 * The "last synced" text of a link, with the stale mark.
 *
 * @param {{lastSyncedAt: string, stale: boolean}} link - The link.
 * @param {number} now - Current epoch milliseconds.
 * @returns {string} For example `last synced 5 min ago (may be out of date)`.
 */
function lastSyncedOf(link, now) {
  const text = `last synced ${RelativeTime.ago(link.lastSyncedAt, now)}`;

  return link.stale ? `${text} (may be out of date)` : text;
}

/**
 * The actions a link offers, derived from its `states`, so the UI never offers an action the
 * API refuses.
 *
 * @param {string[]} states - The link's states.
 * @returns {string[]} A list of `refresh`, `retrySync` and `unlink`.
 */
function actionsOf(states) {
  if (states[0] === 'gone' || states.includes('repository_unavailable')) {
    return ['unlink'];
  }

  return states.includes('sync_failed') ? ['retrySync', 'unlink'] : ['refresh', 'unlink'];
}

/**
 * The view of an issue with no link.
 *
 * @param {{status: string}|null|undefined} repository - The project's repository.
 * @returns {{linked: boolean, text: string, canAttach: boolean, hint: (string|null)}} The view.
 */
function unlinkedView(repository) {
  const base = { linked: false, text: 'Not linked to GitHub' };

  if (!repository) {
    return { ...base, canAttach: false, hint: 'Connect a repository to link issues' };
  }

  if (repository.status === 'unavailable') {
    return { ...base, canAttach: false, hint: 'The project\'s repository is unavailable' };
  }

  return { ...base, canAttach: true, hint: null };
}

/**
 * The view of a linked issue.
 *
 * @param {object} link - The link object.
 * @param {number} now - Current epoch milliseconds.
 * @returns {object} The view.
 */
function linkedView(link, now) {
  const states = link.states?.length ? link.states : [link.state];
  const [primary, ...others] = states;
  const message = messageOf(primary, link, now);
  const goneState = primary === 'gone';
  const lastSynced = goneState ? null : lastSyncedOf(link, now);
  const embedded = primary === 'linked' && lastSynced !== null;

  return {
    linked: true,
    state: primary,
    number: link.number,
    url: typeof link.url === 'string' && link.url.startsWith('https://github.com/') ? link.url : null,
    message: embedded ? { ...message, text: `${message.text} · ${lastSynced}` } : message,
    secondary: others.map((state) => ({ state, ...messageOf(state, link, now) })),
    lastSynced: embedded ? null : lastSynced,
    actions: actionsOf(states),
  };
}

/**
 * Pure presenter of the link panel: from a link, the project's repository and the clock to what
 * the panel shows. It contains no React.
 */
const LinkStatePresenter = {
  /**
   * Describe what the link panel shows.
   *
   * @description An unlinked issue (`link` `null`) gets the unlinked view; a linked one gets its
   * primary message, secondary lines, "last synced" text (null when `gone`, or when the
   * message of the `linked` state already carries it), safe external URL and actions.
   * @param {object|null|undefined} link - The issue's link object.
   * @param {{status: string}|null|undefined} repository - The project's repository (its
   *   status decides whether linking is offered).
   * @param {number} now - Current epoch milliseconds.
   * @returns {object} `{linked: false, text, canAttach, hint}` or `{linked: true, state,
   *   number, url, message, secondary, lastSynced, actions}`.
   */
  present(link, repository, now) {
    return link ? linkedView(link, now) : unlinkedView(repository);
  },
};

export default LinkStatePresenter;
