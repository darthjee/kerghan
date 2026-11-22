/**
 * The words for each field an attach can replace, in the order they are listed. Only these
 * names are ever shown, never GitHub content.
 *
 * @type {Map<string, string>}
 */
const FIELD_NAMES = new Map([
  ['title', 'title'],
  ['body', 'body'],
  ['state', 'state'],
]);

/**
 * Join names as "a", "a and b" or "a, b and c".
 *
 * @param {string[]} names - The names.
 * @returns {string} The list in words.
 */
function joinNames(names) {
  if (names.length < 2) {
    return names.join('');
  }

  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Builder of the attach warning's sentence from `meta.differences`.
 */
const AttachWarning = {
  /**
   * Build the sentence of the differences warning (E61).
   *
   * @description Built from a fixed field-name table; an unknown entry is dropped, so nothing
   * from GitHub is ever echoed.
   * @param {Array<string>|undefined} differences - The differing fields (`title`, `body`,
   *   `state`).
   * @returns {string} For example "GitHub's title and body will replace this issue's title and
   *   body."
   */
  sentence(differences) {
    const known = [...FIELD_NAMES.keys()].filter((field) => Array.isArray(differences) && differences.includes(field));

    if (known.length === 0) {
      return 'GitHub\'s values will replace this issue\'s values.';
    }

    const names = joinNames(known.map((field) => FIELD_NAMES.get(field)));

    return `GitHub's ${names} will replace this issue's ${names}.`;
  },
};

export default AttachWarning;
