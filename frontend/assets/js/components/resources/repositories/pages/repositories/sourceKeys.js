/**
 * Keys identifying a source (an integration or the GitHub handle) across a repository row's
 * `sources[]` and the sync state's `sources[]`.
 */
const SourceKeys = {
  /**
   * The key of a source: `integration:<uuid>` or `handle:<handle>`.
   *
   * @param {{kind: string, integration: ({uuid: string}|undefined), handle: (string|undefined)}}
   *   source - A source entry.
   * @returns {string} The source key.
   */
  keyOf(source) {
    return source.kind === 'integration'
      ? `integration:${source.integration.uuid}`
      : `handle:${source.handle}`;
  },

  /**
   * The dismissal key of a sync-state source: its key, status and last run.
   *
   * @param {object} source - A sync-state source entry.
   * @returns {string} `key|status|syncedAt`.
   */
  dismissalKey(source) {
    return `${SourceKeys.keyOf(source)}|${source.status}|${source.syncedAt}`;
  },

  /**
   * Human label of a source: `integration "work-pat"` or `GitHub handle "darthjee"`.
   *
   * @param {object} source - A source entry.
   * @returns {string} The label.
   */
  labelOf(source) {
    return source.kind === 'integration'
      ? `integration "${source.integration.label}"`
      : `GitHub handle "${source.handle}"`;
  },
};

export default SourceKeys;
