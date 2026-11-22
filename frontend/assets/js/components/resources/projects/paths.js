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
