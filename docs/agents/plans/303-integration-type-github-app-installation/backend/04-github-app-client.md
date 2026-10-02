# GitHub App client calls
`github-client.service.ts` is near the line limit, so add a separate injectable
`GithubAppClientService` reusing `send()`-style helpers from `github-http.ts`/`github-answer.ts`:
- `listUserInstallations(userToken, pageUrl?)` → `{ installations, nextUrl }` parsed from
  `Link: rel="next"`; uses a **larger body cap** than `GITHUB_MAX_BODY_BYTES` (64 KiB), e.g. 1 MiB,
  since `per_page=100` answers can be hundreds of KB.
- `getAppInstallation(jwt, id)` → account, `app_id`, `permissions`, `repository_selection`,
  `suspended_at`.
- `createInstallationToken(jwt, id)` → status only; the `ghs_` token is dropped immediately.

Make `exchangeOauthCode`'s `codeVerifier` optional (not sent when absent) so the github_app
exchange reuses it; keep the OAuth App behaviour unchanged. `revokeOauthToken` is reused as is.
Extend the fake client (queues/defaults and `Pick<>` list) for the new methods.

## Files to Change
- `backend/src/integrations/github-app-client.service.ts` — new.
- `backend/src/integrations/github-client.service.ts` — optional `codeVerifier`.
- `backend/src/integrations/github-http.ts` — body-cap parameter if needed.
- `backend/src/integrations/tests/support/fake-github-client.ts` — new methods.
- `backend/src/integrations/tests/github-app-client.service.spec.ts` — new (pagination, Link, body cap, error statuses).
