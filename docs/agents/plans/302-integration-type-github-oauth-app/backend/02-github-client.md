# GitHub client: code exchange and token revocation

Extend `GithubClientService`, the only place that calls GitHub, with two typed methods. Reuse
its safeguards:

- `redirect: 'error'`;
- `AbortSignal.timeout(GITHUB_TIMEOUT_MS)`;
- the capped body read;
- the normalised rate-limit headers;
- a sanitized `GithubClientError` on network errors and timeouts.

**`exchangeOauthCode({ clientId, clientSecret, code, codeVerifier, redirectUri })`:**

- `POST https://github.com/login/oauth/access_token` with `Accept: application/json` and the
  `User-Agent`, sending `client_id`, `client_secret`, `code`, `redirect_uri` and `code_verifier`.
- It returns a normalised answer, never a raw response:
  - `status`;
  - `accessToken: Secret<string> | null`, set only when the body has an `access_token` string;
  - `error: string | null`, GitHub's `error` code only (GitHub reports errors as a 200 with an
    `error` field);
  - the rate-limit and `retryAfter` fields.
- `error_description` is never kept.

**`revokeOauthToken({ clientId, clientSecret, token })`:**

- `DELETE https://api.github.com/applications/{client_id}/token`.
- HTTP Basic `client_id:client_secret`, with body `{ "access_token": "<token>" }` and the usual
  API version headers.
- Returns `{ status }`. Never call the `/grant` endpoint.

Update `tests/support/fake-github-client.ts` so specs can script answers for both calls and
assert the calls made (with secrets compared without logging them).

Specs (extend `tests/github-client.service.spec.ts`, stubbing `fetch` as it already does):

- correct URL, method, headers and body for both calls;
- the exchange's `error` answer is parsed, and an `access_token` answer is wrapped in a `Secret`;
- timeouts and network errors become `GithubClientError`;
- a canary client secret, code and token never appear in thrown errors.

## Files to Change

- `backend/src/integrations/github-client.service.ts` — add `exchangeOauthCode` and `revokeOauthToken`, plus their answer types.
- `backend/src/integrations/tests/support/fake-github-client.ts` — fake both calls.
- `backend/src/integrations/tests/github-client.service.spec.ts` — specs for both calls.
