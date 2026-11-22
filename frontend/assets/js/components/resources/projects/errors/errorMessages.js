import { isUuid } from '../../../../utils/ids/uuid.js';

const REPOSITORY_NOT_FOUND_MESSAGE = 'Repository not found';

/**
 * Message of `PROJECT_HAS_LINKS`, from `meta.linkCount`.
 *
 * @param {{message: string, meta: (object|undefined)}} error - The error.
 * @returns {{message: string}} The description; the API's message when the count is missing.
 */
function hasLinks(error) {
  const count = error.meta?.linkCount;

  if (!Number.isInteger(count) || count < 0) {
    return { message: error.message };
  }

  return { message: `${count} linked issues use this repository; unlink them before changing it` };
}

/**
 * Message of `PROJECT_REPOSITORY_TAKEN`, with a link to the existing project.
 *
 * @param {{message: string, meta: (object|undefined)}} error - The error.
 * @returns {{message: string, link: ({href: string, text: string}|undefined)}} The
 *   description; the link only appears when `meta.projectId` is a uuid (S3).
 */
function repositoryTaken(error) {
  const projectId = error.meta?.projectId;

  if (!isUuid(projectId)) {
    return { message: error.message };
  }

  return {
    message: error.message,
    link: { href: `#/projects/${encodeURIComponent(projectId)}`, text: 'Open the existing project' },
  };
}

/**
 * Message of a rate-limit code, with the seconds to wait.
 *
 * @param {{message: string, retryAfterSeconds: (number|undefined)}} error - The error.
 * @returns {{message: string, retryAfterSeconds: (number|undefined)}} The API's message and
 *   `retryAfterSeconds`, `undefined` when the error carried none.
 */
function rateLimited(error) {
  return { message: error.message, retryAfterSeconds: error.retryAfterSeconds };
}

/**
 * Describers by error code; each receives the error and answers `{message, link?, details?}`.
 *
 * @type {Map<string, Function>}
 */
const DESCRIBERS = new Map([
  ['PROJECT_REPOSITORY_TAKEN', repositoryTaken],
  ['PROJECT_HAS_LINKS', hasLinks],
  ['PROJECT_REPOSITORY_CHANGED', () => ({ message: 'The project\'s repository changed; try again.' })],
  ['GITHUB_UNAVAILABLE', () => ({ message: 'GitHub is unavailable right now; try again.' })],
  ['ISSUE_LINKED', () => ({ message: 'Unlink this issue before deleting it' })],
  ['ISSUES_LIMIT_REACHED', (error) => ({ message: error.message })],
  ['ISSUE_EDIT_RATE_LIMITED', rateLimited],
  ['ISSUE_LINK_RATE_LIMITED', rateLimited],
  ['GITHUB_RATE_LIMITED', rateLimited],
  ['VALIDATION_FAILED', (error) => ({ message: error.message, details: error.details ?? [] })],
]);

/** The error codes that carry a `retryAfterSeconds` countdown. */
const RATE_LIMIT_CODES = new Set(['ISSUE_EDIT_RATE_LIMITED', 'ISSUE_LINK_RATE_LIMITED', 'GITHUB_RATE_LIMITED']);

/**
 * The form field each code points at; anything not listed is a form-level error.
 *
 * @type {Map<string, string>}
 */
const FIELDS = new Map([
  ['PROJECT_NAME_TAKEN', 'name'],
  ['PROJECT_REPOSITORY_NOT_ADDED', 'repository'],
  ['PROJECT_REPOSITORY_TAKEN', 'repository'],
]);

/**
 * The shared code-to-renderer map of the Issues and Projects screens. Every error shows the
 * API's own message (`ApiError.message`) unless the screen adds something for its code.
 * The issue codes (including the three rate-limit codes) are described here too.
 */
const ProjectErrorMessages = {
  /** Shown on Name when the shortcut found the default name taken. */
  nameTaken: 'A project with this name already exists',

  /**
   * Describe an error for display, as React text (never markup: S1).
   *
   * @param {{message: string, code: (string|undefined), meta: (object|undefined),
   *   details: (string[]|undefined), retryAfterSeconds: (number|undefined)}} error - The thrown
   *   error (usually an `ApiError`).
   * @returns {{message: string, link: ({href: string, text: string}|undefined),
   *   details: (string[]|undefined), retryAfterSeconds: (number|undefined)}} The text to show,
   *   plus a link to the existing project (`PROJECT_REPOSITORY_TAKEN`), the listed validation
   *   `details`, or `retryAfterSeconds` (the three rate-limit codes) when the code has them.
   */
  describe(error) {
    const describer = DESCRIBERS.get(error?.code);

    if (describer) {
      return describer(error);
    }

    return { message: error?.message || 'Request failed' };
  },

  /**
   * Tell where on a form an error belongs.
   *
   * @description `PROJECT_NAME_TAKEN` is the Name field's; `PROJECT_REPOSITORY_NOT_ADDED`,
   * `PROJECT_REPOSITORY_TAKEN` and the `404` of a repository that is not found are the
   * Repository field's. Anything else (for example `PROJECTS_LIMIT_REACHED`) is form-level.
   * @param {{code: (string|undefined), status: (number|undefined), message: string}} error -
   *   The thrown error.
   * @returns {string} `'name'`, `'repository'` or `'form'`.
   */
  fieldOf(error) {
    const field = FIELDS.get(error?.code);

    if (field) {
      return field;
    }

    const repositoryNotFound = error?.status === 404 && error.message === REPOSITORY_NOT_FOUND_MESSAGE;

    return repositoryNotFound ? 'repository' : 'form';
  },

  /**
   * Tell whether an error means the project itself is gone (U1): a `404` that is not the
   * repository's.
   *
   * @param {{status: (number|undefined), message: string}} error - The thrown error.
   * @returns {boolean} `true` for a project `404`.
   */
  isProjectNotFound(error) {
    return error?.status === 404 && ProjectErrorMessages.fieldOf(error) !== 'repository';
  },

  /**
   * Tell whether an error means the issue (or its project) is gone: a `404` on an issue route.
   *
   * @param {{status: (number|undefined)}} error - The thrown error.
   * @returns {boolean} `true` for a `404`.
   */
  isIssueNotFound(error) {
    return error?.status === 404;
  },

  /**
   * Tell whether an error is one of the three rate-limit codes (`ISSUE_EDIT_RATE_LIMITED`,
   * `ISSUE_LINK_RATE_LIMITED`, `GITHUB_RATE_LIMITED`), which show a countdown.
   *
   * @param {{code: (string|undefined)}} error - The thrown error.
   * @returns {boolean} `true` for a rate-limit code.
   */
  isRateLimit(error) {
    return RATE_LIMIT_CODES.has(error?.code);
  },
};

export default ProjectErrorMessages;
