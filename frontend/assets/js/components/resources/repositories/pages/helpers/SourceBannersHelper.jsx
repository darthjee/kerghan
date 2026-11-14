import SourceKeys from '../repositories/sourceKeys.js';

const SILENT_STATUSES = new Set(['ok', 'pending']);
const INTEGRATIONS_LINK = <a href="#/account/integrations">Fix it in Integrations</a>;
const ACCOUNT_LINK = <a href="#/account/my-account">Check it on your Account page</a>;

/**
 * Banner text and optional link by source status; each builder receives the source and its
 * label.
 *
 * @type {Map<string, Function>}
 */
const BANNERS = new Map([
  ['invalid_credentials', (source, label) => ({
    text: `${label} failed: invalid credentials.`, link: INTEGRATIONS_LINK,
  })],
  ['rate_limited', (source, label) => ({
    text: `${label} hit GitHub's rate limit; it will retry after ${new Date(source.resetAt).toLocaleString()}.`,
  })],
  ['page_cap_reached', (source, label) => ({
    text: `${label} has more repositories than Kerghan reads; some may be missing.`,
  })],
  ['not_found', (source, label) => ({
    text: `${label} was not found on GitHub.`, link: ACCOUNT_LINK,
  })],
  ['error', (source, label) => ({
    text: `${label} could not be read from GitHub; its repositories may be out of date.`,
  })],
]);

/**
 * Describe the banner of a source, if it has one.
 *
 * @param {object} source - A sync-state source entry.
 * @param {Set<string>} dismissed - The dismissed banner keys.
 * @returns {{text: string, link: (React.ReactElement|undefined)}|null} The banner, or `null`
 *   when the source is fine, pending, dismissed, or cannot have that status.
 */
function describe(source, dismissed) {
  const invalidHandle = source.kind === 'handle' && source.status === 'invalid_credentials';

  if (SILENT_STATUSES.has(source.status) || invalidHandle || dismissed.has(SourceKeys.dismissalKey(source))) {
    return null;
  }

  return BANNERS.get(source.status)?.(source, SourceKeys.labelOf(source)) ?? null;
}

/**
 * Render one dismissible banner.
 *
 * @param {object} source - The sync-state source entry.
 * @param {{text: string, link: (React.ReactElement|undefined)}} banner - The banner content.
 * @param {{onDismiss: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The banner.
 */
function renderBanner(source, banner, handlers) {
  return (
    <div
      key={SourceKeys.dismissalKey(source)}
      className="alert alert-warning d-flex justify-content-between align-items-start"
      role="alert"
    >
      <span>
        {banner.text}
        {banner.link ? <> {banner.link}</> : null}
      </span>
      <button type="button" className="btn-close" aria-label="Dismiss" onClick={handlers.onDismiss(source)} />
    </div>
  );
}

/**
 * Rendering helper for the per-source error banners.
 */
const SourceBannersHelper = {
  /**
   * Render a dismissible banner for every source whose status is not `ok` or `pending`.
   *
   * @param {{sources: Array<object>}} sync - The sync-state object.
   * @param {Set<string>} dismissed - The dismissed `key|status|syncedAt` keys.
   * @param {{onDismiss: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The banners.
   */
  render(sync, dismissed, handlers) {
    const banners = sync.sources.map((source) => [source, describe(source, dismissed)]);

    return (
      <div>
        {banners.map(([source, banner]) => (banner ? renderBanner(source, banner, handlers) : null))}
      </div>
    );
  },
};

export default SourceBannersHelper;
