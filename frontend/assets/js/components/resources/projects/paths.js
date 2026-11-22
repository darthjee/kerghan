import ListQuery from './listQuery.js';

/** The issue list's `state` filter values; the first is the default. */
const ISSUE_STATES = ['open', 'closed', 'all'];

/**
 * Hashes of the project screens. Every id is `encodeURIComponent`-ed, so no id can change the
 * path (S3).
 */
const ProjectPaths = {
  /** The project list. */
  list: '#/projects',

  /**
   * The project page.
   *
   * @param {string} projectId - The project's uuid.
   * @returns {string} The hash.
   */
  show(projectId) {
    return `#/projects/${encodeURIComponent(projectId)}`;
  },

  /**
   * The project management page.
   *
   * @param {string} projectId - The project's uuid.
   * @returns {string} The hash.
   */
  edit(projectId) {
    return `#/projects/${encodeURIComponent(projectId)}/edit`;
  },

  /**
   * The issue list of a project (the project page), with its query.
   *
   * @param {string} projectId - The project's uuid.
   * @param {{page: number, search: string, state: string}} [query] - The list query
   *   (defaults leave the query out).
   * @returns {string} The hash.
   */
  issues(projectId, query = { page: 1, search: '', state: 'open' }) {
    return ListQuery.toHash(`/projects/${encodeURIComponent(projectId)}`, query, { states: ISSUE_STATES });
  },

  /**
   * The issue page.
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @returns {string} The hash.
   */
  issue(projectId, issueId) {
    return `#/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}`;
  },

  /**
   * The issue creation form.
   *
   * @param {string} projectId - The project's uuid.
   * @returns {string} The hash.
   */
  newIssue(projectId) {
    return `#/projects/${encodeURIComponent(projectId)}/issues/new`;
  },

  /**
   * The issue edit form.
   *
   * @param {string} projectId - The project's uuid.
   * @param {string} issueId - The issue's uuid.
   * @returns {string} The hash.
   */
  editIssue(projectId, issueId) {
    return `#/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/edit`;
  },

  /**
   * The explicit creation form, optionally prefilled (the shortcut's fallback).
   *
   * @param {{githubId: number, fullName: string, name: string, nameTaken: boolean}} [prefill] -
   *   The repository to preselect (`githubId`, and `fullName` for display), the name to
   *   start with, and whether to show the "name taken" error on Name.
   * @returns {string} The hash (`#/projects/new` without a prefill).
   */
  newProject(prefill) {
    if (prefill === undefined) {
      return '#/projects/new';
    }

    const params = new URLSearchParams({
      repository: String(prefill.githubId),
      repositoryName: prefill.fullName,
      name: prefill.name,
    });

    if (prefill.nameTaken) {
      params.set('error', 'name_taken');
    }

    return `#/projects/new?${params.toString()}`;
  },
};

export default ProjectPaths;
