# Issues and Projects UI — Decisions

Rejected alternatives, backward compatibility, and performance and security. Back to the [Issues and Projects UI](../ui.md) hub.

## Rejected alternatives

One line each:

1. A project overview route separate from the issue list: nothing to show there in v1.
2. Inline editing: more component state, and no deep link to a form.
3. List state in component state only: Back and reload would lose the filter and page.
4. A shortcut that always opens a prefilled form: an extra step; the form is the fallback only when the name is taken.
5. A plain `<select>` repository picker: breaks past 100 added repositories.
6. A pre-count of unsent changes in the API for the delete confirmation: an extra query and a reversal of "no counts"; the count is shown after the delete instead.
7. A plain confirmation for project delete: the hard delete of every issue with no restore warrants typing the name.
8. Every state as a badge in list rows: noisy; the full set lives on the issue page.
9. Refresh on a `sync_failed` link: confusing next to Retry sync, since a refresh never clears a failure that belongs to an unsent write.
10. No re-read, or a single fixed re-read, after triggers: reads too early or too late, or forces manual reloads.
11. A full UI wording map for every error code: more to keep in sync; the API strings are final English.
12. `window.confirm` for simple confirmations: mixed look, and it blocks tests.
13. A number-only GitHub input: pasting the URL is common; it is parsed client-side, so the API still takes only the number.
14. Always confirming unlink: unlinking is reversible; only unsent changes warrant a warning (E63).
15. An API concurrency token on edit (`ifUpdatedAt`): the focus banner (U10) covers the common case without an API change.
16. Naming the healthy badge "Linked": "Synced" says what the user cares about.

## Backward compatibility

Every change to the existing UI is additive. The touch points for the implementation (#560 to #562, and #563):

| Area | Change | Compatibility |
|---|---|---|
| Header | A "Projects" link next to "Repositories" (logged in only) | Header specs gain one link; the logged-out and pending views are unchanged |
| Repositories page | A "Project" button on Added rows | Add, filter and refresh are unchanged; the table specs gain the button case |
| `HashRouteResolver` | 7 new routes | Literal segments are registered before parameters (`/projects/new` before `/projects/:projectId`, `…/issues/new` before `…/issues/:issueId`); existing routes are untouched |
| `ApiError` | A new optional `meta` | `undefined` when absent; existing callers are unaffected |
| `ConfirmModal` | New in `components/common/` | The admin users page keeps `window.confirm`; no migration in this epic |
| Dependencies | `react-markdown` and `remark-gfm` ([security.md](../security.md#bodies-restricted-markdown)) | Installed through docker-compose only, never on the host |
| Docs | `architecture/frontend.md` (layout, routes, `ApiError.meta`) | Updated by the implementation, not by the spec PR |

## Performance and security

**Security:**

- **S1.** Bodies render only through `IssueBody` under the restricted-Markdown rules of [security.md](../security.md#bodies-restricted-markdown); Preview uses the same component. Titles, project names and descriptions, repository names, search echoes and error messages render as React text. The Issues screens have no `dangerouslySetInnerHTML` (static check).
- **S2.** A link's `url` renders only when it starts with `https://github.com/`; external links get `rel="noopener noreferrer"` and `target="_blank"`. The UI never navigates to a URL the user typed: the link modal only extracts the number.
- **S3.** Ids taken from the hash (`:projectId`, `:issueId`) and from `meta.projectId` / `meta.issueId` are checked as uuids client-side before any request path or link is built. A non-uuid shows "not found" with no call. Path segments are always `encodeURIComponent`-ed, so a crafted hash such as `#/projects/..%2Fadmin` cannot change the request path.
- **S4.** Form drafts are never saved to `localStorage` or `sessionStorage` (bodies may hold private content).
- **S5.** No screen names an integration or shows credential data; credential problems point to Integrations generically.

**Performance:**

- **P1.** Lists never load bodies; the default `perPage` is 50, as in the API.
- **P2.** Searches (both lists and the repository picker) are debounced by about 300 ms, and out-of-order responses are ignored: only the latest request's answer is applied.
- **P3.** Preview renders only when its tab is selected, never on each keystroke.
- **P4.** Re-reads are bounded ([Re-reading after a trigger](linking-and-sync.md#re-reading-after-a-trigger)) and focus re-reads are throttled to 30 s.
- **P5.** `IssueBody` (with `react-markdown` and `remark-gfm`) is lazy-loaded (`React.lazy`, its own Vite chunk), so pages without bodies pay nothing. While it loads, the body shows as plain text in a `<pre>`.

