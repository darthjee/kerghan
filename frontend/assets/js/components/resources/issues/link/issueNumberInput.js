/** The largest issue number the API accepts (a 32-bit signed integer). */
const MAX_NUMBER = 2147483647;

const INVALID_MESSAGE = 'Enter an issue number or GitHub issue URL';

const NUMBER_PATTERN = /^#?(\d{1,10})$/;
const URL_PATTERN = /^https:\/\/github\.com\/([^/\s?#]+)\/([^/\s?#]+)\/issues\/(\d{1,10})\/?$/i;

/**
 * Turn digits into a number within the API's range.
 *
 * @param {string} digits - The matched digits.
 * @returns {{number: number}|{error: string}} The number, or the invalid-input error.
 */
function toNumber(digits) {
  const number = Number(digits);

  if (!Number.isSafeInteger(number) || number < 1 || number > MAX_NUMBER) {
    return { error: INVALID_MESSAGE };
  }

  return { number };
}

/**
 * Parse an issue URL against the project's repository.
 *
 * @param {RegExpMatchArray} match - The match of the URL pattern.
 * @param {{fullName: string}} repository - The project's repository.
 * @returns {{number: number}|{error: string}} The number, or the error.
 */
function fromUrl(match, repository) {
  const [, owner, name, digits] = match;

  if (`${owner}/${name}`.toLowerCase() !== String(repository?.fullName).toLowerCase()) {
    return { error: `This issue is not in ${repository?.fullName}` };
  }

  return toNumber(digits);
}

/**
 * Parser of the shared input of the import and attach modals.
 */
const IssueNumberInput = {
  /**
   * Parse what the user typed in a link modal.
   *
   * @description Accepts `12`, `#12` and `https://github.com/<owner>/<name>/issues/12`, trimmed.
   * Only the number is ever sent to the API.
   * @param {string} raw - The typed text.
   * @param {{fullName: string}} repository - The project's repository.
   * @returns {{number: number}|{error: string}} The issue number, or the message to show.
   */
  parse(raw, repository) {
    const text = String(raw ?? '').trim();
    const numeric = NUMBER_PATTERN.exec(text);

    if (numeric) {
      return toNumber(numeric[1]);
    }

    const url = URL_PATTERN.exec(text);

    return url ? fromUrl(url, repository) : { error: INVALID_MESSAGE };
  },
};

export default IssueNumberInput;
