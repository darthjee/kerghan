# Architecture — Frontend

React 19 + Vite, built and tested the same way regardless of backend language. Hash-based
routing, a `client/` HTTP layer, and a login/register/device-authorization modal already exist
(see "Auth flow" below) — the dashboard/analytics views themselves (issue volume, age, label
breakdowns, "needs attention" lists) are still to come.

## Stack

- React 19 (no React Bootstrap/UI kit chosen yet — Majora's is deliberately not carried over)
- Vite (dev server on port 8080, `npm run build` outputs to `dist/`, matching the
  `docker_volumes/static` bind mount)
- Jasmine + c8 (tests/coverage), driven through a custom Node ESM loader
  (`specs/support/jsx-loader.mjs`) that transforms `.jsx` via Babel, stubs image/CSS imports,
  and shims `import.meta.env` for Node-based specs
- ESLint (flat config, `eslint.config.mjs`) — 2-space indent, single quotes, semicolons
  required, max complexity 10, max 300 lines/file, JSDoc required on public API

## Directory layout (current)

```
frontend/assets/js/
  App.jsx, main.jsx           # entry point — mounts App into #root
  components/
    AppController.js          # resolves the current route, renders the matching page
    common/
      header/                 # Header.jsx + controller/helper/hook — Login/Logout nav
      loginModal/             # LoginModal.jsx — route-independent, opened via LoginModalEvents
      ModalRedirect.jsx       # #/login, #/register → open the modal in that mode
      forms/                  # shared account-edit form pieces: helpers/ (JSX),
                              #   controllers/AccountEditFormController.js (base class for
                              #   MyAccountController / AdminUserEditController) and
                              #   hooks/useAccountEditForm.js (shared state/handler wiring
                              #   for MyAccount / AdminUserEdit)
    resources/
      home/pages/Home.jsx
      accounts/pages/          # AuthorizationRequests ("My account"), ResetPasswordLanding
      admin/pages/AdminUsers.jsx
      projects/                # Issues and Projects screens — see "Projects module" below
  client/                      # AccountsClient, AdminClient, ApiClient, ApiError,
                                #   AuthSession, AuthEvents, LoginModalEvents,
                                #   ProjectsClient, IssuesClient, pathId.js,
                                #   pickDefined.js (drops undefined keys from request bodies)
  utils/
    ids/uuid.js                # isUuid — the uuid guard for ids taken from the hash (S3)
    routing/                   # Router, Route, HashRouteResolver, currentHash, hashLocation
    polling/AuthorizationRequestPoller.js
    validation/                # fieldValidators, formValidators, projectValidators
                                #   (shared client-side form rules)

frontend/specs/                # mirrors assets/js/ above, one spec per source file
  support/jsx-loader.mjs
```

Dashboard/analytics views (issue volume, age, label breakdowns, "needs attention" lists) don't
exist yet — mirror Majora's shape (`components/`, `client/`, `utils/`), already followed above,
rather than inventing a new one — see `frontend.md` in `.claude/agents/` for the full
component-extraction conventions to apply as it grows. Given `docs/agents/product.md`'s
"aggregation-friendly, not just CRUD" API design, expect the eventual dashboard `client/` layer to
fetch pre-aggregated dashboard data (counts, groupings, "needs attention" lists) rather than raw
per-issue CRUD — plus, per `docs/agents/flow.md`, some of that fetching happens directly against
GitHub's API rather than the backend at all.

## Auth flow

`client/AccountsClient.js` wraps every `auth` route the backend exposes — see
`docs/agents/modules/auth.md` for the request/response contract, not duplicated here:

- `register(fields)` — `POST /auth/register.json`
- `login({ username, password })` — `POST /auth/login.json`
- `refresh()` — `POST /auth/refresh.json`
- `logout()` — `DELETE /auth/logoff.json`
- `status()` — `POST /auth/status.json`
- `migrateLegacyToken(token)` — one-time `POST /auth/refresh.json` with `{ refreshToken }`
  (`TODO(#324-migration)`, see below)
- `recover(email)` / `resetPassword(fields)` — `POST /auth/recover.json` / `POST /auth/reset-password.json`
- `createAuthorizationRequest(username)`, `pollAuthorizationRequest(uuid, pollToken)`,
  `listAuthorizationRequests()`, `authorizeAuthorizationRequest(uuid, password)`,
  `denyAuthorizationRequest(uuid)` — the device-authorization flow's five endpoints (see
  `docs/agents/modules/auth/device-authorization.md`'s "Device-authorization flow" section)

The frontend never reads, stores or sends the refresh token. The backend sets it as an
`httpOnly` `refresh_token` cookie (`Path=/auth`), alongside the `httpOnly` access-token cookie,
on every session-minting response (`register`/`login`/`refresh` and a winning
`pollAuthorizationRequest`), and clears both on logoff, on a failed refresh, and on a `status`
that answers `loggedIn: false` (see `docs/agents/modules/auth.md`). No request body carries a
`refreshToken`; the browser sends the cookie on its own (`credentials: 'same-origin'`).

The only auth state JavaScript can see is the readable `logged_in=1` hint cookie (`Path=/`), set
and cleared by the backend together with the `refresh_token` cookie. `client/AuthSession.js`
reads it: `isLoggedIn()` means "probably logged in" (the mount-time `status` call confirms).
`AuthSession` also exposes `takeLegacyToken()`, which returns the refresh token older builds left
in `localStorage` under `kerghan_refresh_token` and removes the key.

**Legacy-token migration (`TODO(#324-migration)`).** Before its mount-time status check,
`HeaderController#checkStatus` runs `migrateIfNeeded()`: it takes the legacy `localStorage`
token (if any) and posts it once via `AccountsClient.migrateLegacyToken` (through
`ApiClient.postJsonOnce`, i.e. without the `401`-retry loop, swallowing failures) so the backend
sets the cookies. The key is removed whatever the outcome, so the migration runs at most once per
browser. Remove this branch together with the backend's body-carried refresh fallback.

`client/ApiClient.js` reacts to a `401` transparently rather than surfacing it to callers: when
the `logged_in` hint cookie is present it calls `POST /auth/refresh.json` with an empty body
directly (a plain internal request, not through `AccountsClient`, to avoid a circular import; the
`refresh_token` cookie rides along) and retries the original request exactly once. If the hint
cookie is absent, or the refresh call itself fails (invalid/expired/already-revoked refresh
token) or the retried request comes back `401` again, `ApiClient` treats the session as expired:
it opens the login modal in Password mode via `client/LoginModalEvents.js` (the backend has
already cleared the cookies), instead of resolving/rejecting the original call normally or
redirecting to a dedicated route.

### Login modal

`components/common/loginModal/LoginModal.jsx` is the single, route-independent entry point for
every auth interaction — standalone login/register pages no longer exist. It is opened/closed
via the shared `client/LoginModalEvents.js` bus (from the header, from `ApiClient`'s
session-expired handling above, or from `components/common/ModalRedirect.jsx`, which the
`#/login` and `#/register` hash routes resolve to so a direct link still opens the modal in the
right mode) and driven by `LoginModalController`/`useLoginModal`/`useDeviceCountdown`. Its modes:

- **Password** / **Register** — the classic username/password flows; both converge on the same
  success path (close the modal, redirect home).
- **Recover** / **Set-new-password** — `AccountsClient.recover`/`resetPassword`; the modal stays
  open on a neutral/success result panel instead of redirecting.
- **Authorize-with-logged-device** — drives `AccountsClient.createAuthorizationRequest` then
  hands off to `utils/polling/AuthorizationRequestPoller.js`, which polls
  `pollAuthorizationRequest` on a 5s cadence until the request is approved, rejected
  (`denied`/`expired`/`logged`), or a `404` (`notFound`) is thrown; a winning `approved` poll
  converges on the same success path as Password/Register. The modal shows a waiting panel with a
  countdown (driven by a 1s ticker down to the request's `expiresAt`) while polling, then its own
  terminal panel.

The approving device reviews and resolves open requests from the "My account" page
(`components/resources/accounts/pages/AuthorizationRequests.jsx` +
`AuthorizationRequestsController`/`AuthorizationRequestsHelper`), which calls
`AccountsClient.listAuthorizationRequests`/`authorizeAuthorizationRequest`/
`denyAuthorizationRequest` — see `docs/agents/modules/auth.md` for the backend contract behind
all of this.

`components/common/header/Header.jsx` keeps `loggedIn`/`isAdmin` state in sync with the shared
`client/AuthEvents.js` bus (via `useAuthEffect`, confirmed at mount time through
`HeaderController#checkStatus`, which runs the legacy-token migration and then calls
`AccountsClient.status`) rather than only reading `AuthSession.isLoggedIn()` once at render time, so it reacts to any auth-state change (login,
logout, or a winning device-authorization poll) independently of a page redirect. It shows a
Login nav link when logged out, or a Logout action when logged in. Logging out calls
`AccountsClient.logout` (the backend clears the session cookies) and redirects home regardless of
whether the request succeeded.

**Pending approval.** When [user approval](../modules/auth/user-approval.md) applies, the
`AuthEvents` bus also carries a `pending` flag (with `loggedIn` and `isAdmin` both `false`), set
from `status.json`'s `status: "pending"` by `client/AuthStatus.js`. After a successful register
or login the frontend re-checks `status.json` instead of assuming a logged-in state, and while
pending `components/common/awaitingApproval/` replaces the app content with an awaiting-approval
view ("Check again", "Log out", re-check on window focus, no timer polling). A
`403 USER_DENIED` from `login.json` shows a denied message in the login modal; `ApiClient` never
refreshes and retries on a `403`. The admin users page uses `client/AdminClient.js`'s
`searchUsers(q, status)`, `approveUser` and `denyUser`. Details:
[User approval → Frontend](../modules/auth/user-approval.md#frontend).

## API errors

Any non-`401` failure from `client/ApiClient.js` rejects with a `client/ApiError.js`, built from
the backend's standard error body (`{ error: { code, message, details? }, statusCode, timestamp }`
— see `architecture/backend/error-responses.md`'s `## Error responses` section for the format and the
status-to-code mapping):

- `status` — the HTTP status of the response.
- `message` — `error.message`, human-readable and safe to show in the UI. When the body carries
  none (empty or non-JSON body, e.g. a proxy-generated error page), it falls back to the
  response's `statusText`, then to `'Request failed'`, so it is never `undefined`.
- `code` — `error.code` (e.g. `USERNAME_TAKEN`, `EMAIL_TAKEN`, `VALIDATION_FAILED`, `NOT_FOUND`);
  prefer branching on it over matching `message` text. `undefined` when the body carries none.
- `details` — `error.details`, the full list of validation messages; only present on validation
  failures, `undefined` otherwise.
- `meta` — `error.meta`, the code-specific data object (e.g. `projectId` for
  `PROJECT_REPOSITORY_TAKEN`, `linkCount` for `PROJECT_HAS_LINKS`); `undefined` when the body
  carries none, or carries something other than an object. Ids read from `meta` are checked
  with `isUuid` before any link is built.
- `retryAfter` / `retryAfterSeconds` — the `Retry-After` header, and the body's
  `retryAfterSeconds` (preferred) when valid.

## Projects module (Issues and Projects)

The UI of the [Issues and Projects module](../modules/issues/frontend.md), built by #560 (the shared
pieces and the project screens); #561 and #562 add the issue screens and the linking.

**Client.** `client/ProjectsClient.js` and `client/IssuesClient.js` cover every route the
backend exposes (all `POST`, user-scoped). Every id in a path goes through `client/pathId.js`:
it must be a uuid (`utils/ids/uuid.js`) and is `encodeURIComponent`-ed, and a malformed id
rejects with a 404-shaped `ApiError` **before any request** (S3), so a crafted hash such as
`#/projects/..%2Fadmin` can never change the request path.

**Routes** (`utils/routing/HashRouteResolver.js`, literal segments before parameters):

| Route | Page key | Screen |
|---|---|---|
| `#/projects` | `projects` | Project list (`pages/Projects.jsx`); an "Open issues" column after Repository shows `openIssueCount` as "N open" (#563) |
| `#/projects/new` | `project-new` | Creation form (`pages/ProjectNew.jsx`) |
| `#/projects/:projectId` | `project` | Project header (`pages/ProjectPage.jsx`) |
| `#/projects/:projectId/edit` | `project-edit` | Management (`pages/ProjectEdit.jsx`) |
| `#/projects/:projectId/issues/new` | `issue-new` | Issue creation form (`issues/pages/IssueNew.jsx`) |
| `#/projects/:projectId/issues/:issueId` | `issue` | Issue page (`issues/pages/IssuePage.jsx`) |
| `#/projects/:projectId/issues/:issueId/edit` | `issue-edit` | Issue edit form (`issues/pages/IssueEdit.jsx`) |

The project page shows the header and, under it, the issue list (#561); "Refresh project" and
"Import" come with #562. The header's "Projects" link shows for logged-in users only.

**Layout** (`components/resources/projects/`): `pages/` holds one page component per screen,
with `list/`, `new/`, `show/` and `edit/` for the controllers and helpers of each (the usual
Controller / Helper split) and `common/` for what pages share (`ProjectLoadController`,
`ProjectLoadViewHelper`, `NotFoundHelper`, `LoadErrorHelper`, `ProjectFieldsHelper`,
`formErrors`). Shared pieces sit next to `pages/`: `repositoryPicker/` (the debounced search
over added repositories, reused by creation and management), `errors/errorMessages.js` (the
code-to-renderer map: it shows `ApiError.message` and overrides only the codes where the screen
adds something, and maps each code to its field), `listQuery.js` (hash-query parsing and
normalization of `search`, `page` and `state`, U6, reused by #561), `ProjectNoticeStore.js` (the
one-time "Project deleted." notice, in memory), `paths.js` and `RepositoryLabel.jsx`. List state
(`search`, `page`) lives in the hash query: typing replaces the hash in place, a page change
pushes an entry, and a `hashchange` re-reads it. The Repositories page gains a "Project"
shortcut on added rows (`repositories/pages/repositories/ProjectShortcutStore.js`).

**`ConfirmModal`** (`components/common/confirmModal/`): the one confirmation of the Issues
screens (`window.confirm` is not used; the admin users page keeps its own). Props: `title`,
`message`, `confirmLabel`, `danger`, `typeToConfirm`, `onConfirm` (may return a promise) and
`onCancel`. Cancel takes the initial focus, Confirm is on the right (red when `danger`), the
typed text is compared trimmed and case-sensitively (U9), both buttons are disabled with a
spinner while `onConfirm` is pending, and a rejection's message shows inside the modal.

**Dirty-form guard** (`components/common/forms/`, U11): `useDirtyFormGuard(isDirty)` plus
`DirtyFormPrompt`. While a form is dirty the browser warns on close or reload
(`beforeunload`); Cancel and a `hashchange` away from the form restore the previous hash and ask
"Discard unsaved changes?" through `ConfirmModal`; `forceLeave(hash)` leaves without asking
after a successful save or delete. A clean form leaves silently. Nothing is written to
`localStorage` or `sessionStorage` (S4).

**Security** (`specs/assets/js/components/resources/projects/securityStaticSpec.js`): a static
spec fails on `dangerouslySetInnerHTML` (S1) or any storage use (S4) in the project screens,
`ConfirmModal` and the form guard, and on integration or credential wording on the project
screens (S5); names, descriptions and error messages render as React text.

### Issue screens (#561)

Under `components/resources/issues/`, built on `IssuesClient` and the pieces above:

- **List** (`list/`): `IssueList` mounts under the project header. `IssuesController` keeps
  `search`, `page` and `state` in the hash query through `listQuery.js` (normalized, U6),
  debounces the search, ignores out-of-order answers and jumps to the last page when the
  requested one is past the end (U5). The link column is `link/LinkStateBadge` and
  `link/GithubLink` (rendered only for `https://github.com/` URLs); `IssueStateBadge` is shared
  with the issue page.
- **Bulk close and reopen** (#563, in `list/`): the table has a checkbox column and a "select all
  on this page" checkbox (indeterminate when only some rows are checked). `BulkSelectionController`
  holds the selection, a set of issue ids of the current page, in memory only (S4). It is cleared
  by `IssuesController` on every page, state or search change and when the hash brings a new
  query, never by a plain re-read. `IssuesBulkBarHelper` shows "N selected", "Close selected" and
  "Reopen selected" while at least one row is selected. `apply(state)` sends
  `IssuesClient.bulkState` once (both buttons disabled meanwhile, U2), shows a dismissible summary
  notice ("Closed N issues", "M were already closed", "K were no longer found"), clears the
  selection and re-reads the list exactly once; it does not start the bounded re-read. A
  `429 ISSUE_EDIT_RATE_LIMITED` keeps the selection and counts down with the shared
  `RateLimitCountdownController` on both buttons ("Try again in N s"), resubmitting nothing; a
  `404` falls through to the list's own error handling.
- **Issue page** (`pages/IssuePage.jsx`, `pages/show/`, `pages/common/`): `IssueLoadController`
  loads the project, then the issue, and shows "Project not found" or "Issue not found" for a
  400 or 404 (a malformed id makes no call). Close and Reopen send only `{ state }` and ignore a
  second click while in flight (U2). Delete is disabled while the issue is linked, goes through
  `ConfirmModal` and treats a 404 as done. The empty slot between the header and the body
  (`IssueLinkPanelSlotHelper`) is where #562 mounts the link panel.
- **Forms** (`pages/IssueNew.jsx`, `pages/IssueEdit.jsx`, `pages/form/`): title and body
  validated by `utils/validation/issueValidators.js`; the body has Write and Preview tabs and
  `IssueBody` mounts only while Preview is selected. Errors are form-level and keep the typed
  values; the dirty-form guard is wired (U11).
- **`IssueBody`** (`body/`): a lazy wrapper (`React.lazy`) with a `<pre>` fallback; an empty
  body shows a muted "No description." and never loads the chunk. `IssueBodyMarkdown` is the
  separate chunk (`react-markdown` 10.1.0 and `remark-gfm` 4.0.1, pinned exactly): raw HTML is
  shown as escaped text, links are limited to `http`, `https` and `mailto`, images never render
  an `<img>`, task checkboxes are disabled, and there is no `rehype` plugin. Specs render with
  `renderToStaticMarkup`, where a lazy component shows its fallback, so the Markdown rules are
  specified on the non-lazy `IssueBodyMarkdown`.
- **Rate-limit countdown** (`components/common/forms/`, `RateLimitCountdownController` and
  `useRateLimitCountdown`): "Try again in N s" from `retryAfterSeconds`; re-enables at 0, never
  resubmits, clears its timer on unmount. `errorMessages.js` maps `ISSUE_LINKED`,
  `ISSUES_LIMIT_REACHED`, `ISSUE_EDIT_RATE_LIMITED`, `ISSUE_LINK_RATE_LIMITED` and
  `GITHUB_RATE_LIMITED`; only the edit form uses the countdown so far.
- **Security** (`specs/assets/js/components/resources/issues/securityStaticSpec.js`): fails on
  `dangerouslySetInnerHTML`, `.innerHTML`, `.outerHTML`, a `rehype` import, any
  `localStorage`/`sessionStorage` use and integration or credential wording; a `<b>x</b>` title
  renders as escaped text in the list, the page and the forms.

### Linking and sync (#562)

Under `components/resources/issues/link/` and `issues/sync/`, filling the slot #561 left empty:

- **Link panel** (`link/LinkPanel.jsx`, `LinkPanelController.js`, `LinkPanelHelper.jsx`):
  `linkStatePresenter.js` turns the issue's `link` and `states` into the view (state label,
  secondary lines, last synced, stale hint, rate-limit time, and which actions show), so the
  components hold no state rules. The controller runs Refresh, Retry sync and Unlink (with the
  discard confirmation), ignores a second click while busy (U2) and keeps the busy flag until the
  bounded re-read ends. `relativeTime.js`, `LinkClockTicker.js` and `useLinkClock.js` keep the
  relative times fresh. Credential failure wording lives only in `failureReasons.js` and
  `errorMessages.js` (the S5 static specs allow-list those two files).
- **Import and attach** (`link/modals/`): `IssueNumberModal` is shared by `ImportIssueModal` and
  `AttachIssueModal` (each with its controller); `issueNumberInput.js` parses the number.
  `attachWarning.js` names the fields that differ from fixed `title`/`body`/`state` labels only,
  never GitHub content.
- **Bounded re-reads** (`sync/BoundedRereadController.js`): after a trigger, re-reads the issue
  or project at 2, 5 and 10 s, stopping early once the state settles, quietly on error, and on a
  404; it is disposed on unmount (P4). Retry sync treats an issue whose link is still
  `sync_failed` as the 200 no-op and skips the re-read.
- **Focus re-read** (`sync/FocusRereadThrottle.js`, `useFocusReread.js`): re-reads when the tab
  regains focus, at most once every 30 s; both the issue page and the project page use it, through
  a quiet `reread()` on `IssueLoadController` and `ProjectLoadController`.
- **Saved-issue signal** (`sync/savedIssueSignal.js`): an in-memory signal the edit form sets
  after a save, so the issue page re-reads on return (`pages/show/useSavedIssueReread.js`); it
  uses no storage API.
- **Edit form (U10)**: `pages/form/IssueChangedBanner.jsx` and `checkChanged` on
  `IssueFormController` warn that the issue changed while editing, with "Discard my changes and
  reload".
- **Project header**: `projects/pages/show/ProjectHeader.jsx` adds Refresh project (T3,
  `ProjectRefreshController.js`) and an "Import from GitHub" entry, which the empty states repeat;
  `projects/RepositoryHint.jsx` shows the repository status.
- **Security**: `issues/securityStaticSpec.js` already scans `issues/**` recursively; it now also
  asserts `link/`, `link/modals/` and `sync/` are covered, renders the panel with hostile text,
  and checks `savedIssueSignal` uses no storage. The `#N` link renders only for
  `https://github.com/` URLs (S2).

## No Vite proxy to the backend

There is no Vite `server.proxy` config pointing at the backend — that's the Tent proxy's job
(see `architecture/proxy.md`), not Vite's. In dev, Tent forwards non-asset requests to the Vite
dev server for HMR; Vite itself never talks to the backend directly.

See `.claude/agents/frontend.md` for local dev commands, code conventions, and the JSX
extraction rules.
