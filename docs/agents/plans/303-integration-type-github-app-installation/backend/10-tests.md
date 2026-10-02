# Test harness and cross-cutting specs
Extend the test app builder with a `githubApp` option (fake config with a runtime-generated RSA
key — never commit a PEM — and the in-memory state repo). Cover the spec's *Required tests*:
controller e2e (404 when disabled, 400 validation, 201/200/selection, 409/422/423 paths, forged
`installation_id` rejected and counted, parallel callbacks with one state, canaries for code,
tokens, JWT, key, client secret and `state`), generic routes answering `INTEGRATION_FLOW_UNSUPPORTED`
for github_app, `types.json` listing, cache-policy coverage, CSRF.

## Files to Change
- `backend/src/integrations/tests/support/build-integrations-test-app.ts` — `githubApp` option.
- `backend/src/integrations/tests/github-app.controller.e2e-spec.ts` — new.
- `backend/src/integrations/tests/integrations.controller.create.e2e-spec.ts` and the rename/replace e2e spec — github_app flow-unsupported cases.
- `backend/src/core/tests/cache-policy.coverage.spec.ts` — add `GithubAppController`.
