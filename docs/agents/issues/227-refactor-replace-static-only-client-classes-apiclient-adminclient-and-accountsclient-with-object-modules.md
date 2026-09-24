# Issue: Refactor: Replace static-only client classes ApiClient, AdminClient and AccountsClient with object modules

## Description
Three HTTP-layer client classes in `frontend/assets/js/client/` contain only static members, which Codacy flags. The frontend convention (`.claude/agents/frontend.md`, "Helper module shape") already says helpers/clients are plain exported objects, and lists #227–#230 as the migration of the older static classes.

## Problem
`@typescript-eslint/no-extraneous-class` (Warning), 3 findings: `frontend/assets/js/client/ApiClient.js`, `AdminClient.js`, `AccountsClient.js` ("Unexpected class with only static properties"). The rule is stubbed out in `frontend/eslint.config.mjs`, and each class carries an `eslint-disable-next-line` comment, but Codacy still reports it.

## Expected Behavior
- All callers keep writing `ApiClient.method(...)`, `AdminClient.method(...)`, `AccountsClient.method(...)`; default exports and names are unchanged.
- Request behaviour is unchanged: 401 → single refresh + retry, session-expired handling (clear `AuthSession`, open the login modal), 204/empty-body parsing, `ApiError` mapping.
- Existing specs that `spyOn(ApiClient, 'method')` / `spyOn(AdminClient, ...)` / `spyOn(AccountsClient, ...)` (44 call sites across `AccountsClientSpec.js`, `AccountsClientAuthorizationRequestsSpec.js`, `AdminClientSpec.js` and others) keep working without changes to their assertions.

## Solution
- Replace each class with a plain exported object literal of the same name and methods (`const ApiClient = { async postJson(path, body) { … }, … }; export default ApiClient;`).
- Turn `ApiClient`'s `static #private` methods (`#sendJson`, `#handleUnauthorized`, `#request`, `#parseBody`, `#sessionExpired`) into non-exported module-level functions.
- `AdminClient` / `AccountsClient` keep calling `ApiClient.xxx(...)` through the exported object, so spec spies still intercept.
- Do not use `Object.freeze` or namespace imports — Jasmine spies need writable properties.
- Remove the now-obsolete `eslint-disable-next-line @typescript-eslint/no-extraneous-class` comments and update JSDoc `{@link ApiClient.#…}` references to point at the module functions.
- `.codacy.yml`: remove the PMD `exclude_paths` entries for `ApiClient.js` and `AccountsClient.js` (they exist only because PMD misparses `static async #method` syntax — issue #30 — which no longer exists after this change), and trim the accompanying comment accordingly. Keep the `HeaderController.js` entry (covered by #230).
- `.claude/agents/frontend.md` already prescribes the object-module shape; only adjust the "being migrated (#227–#230)" note if appropriate.
- Out of scope: `AuthSession`, `AuthEvents`, `LoginModalEvents` (#228); `ApiError` is a real `Error` subclass and stays a class.

## Benefits
Removes 3 Codacy Warning findings, drops two `.codacy.yml` PMD exclusions, and aligns the client layer with the documented frontend module convention.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
