# GitHub client service

Implement `security.md` "Faking GitHub" and rule 4 of "Secrets never logged".

- `GithubClientService` (injectable, module-internal) is the **only** place that calls GitHub.
  - Its first method is `getUser(token: Secret)`. It sends `GET https://api.github.com/user`
    with the global `fetch` and the headers:
    - `Authorization: Bearer <token>`
    - `Accept: application/vnd.github+json`
    - `X-GitHub-Api-Version`
    - a `User-Agent`

    It has a bounded timeout (`AbortSignal.timeout`).
  - It returns a small, typed, header-normalised result:
    - `status`
    - the parsed `login`, when present
    - `x-oauth-scopes`, `github-authentication-token-expiration`
    - `x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after`

    It never returns raw response objects.
  - Network errors and timeouts are caught and rethrown as a sanitized `GithubClientError`
    carrying only a short reason (and a status when one exists). It carries no request config,
    headers, URL query or original `cause`.
- Export a reusable **fake** for specs (e.g. `tests/support/fake-github-client.ts`): scriptable
  responses per call, and recording of every call (with no token stored in plain form in
  assertion messages).
- Check GitHub's REST docs for the exact header names, as `types/pat.md` asks, and note any
  deviation in the PR.

Specs: only this spec stubs `fetch`.
- Headers sent.
- Header and body parsing.
- Timeout and network error → sanitized error.
- A canary token never appears in the thrown error's message, stack, `JSON.stringify` or
  `util.inspect`.

## Files to Change
- `backend/src/integrations/github-client.service.ts`: new.
- `backend/src/integrations/tests/github-client.service.spec.ts`: new.
- `backend/src/integrations/tests/support/fake-github-client.ts`: new.
