# Canary harness with real Integrations services and request logging

The canary sweeps need credentials to actually travel. That means the **real** `IntegrationsGithubService`, `IntegrationsGithubIssueWriter`, installation-token cache and integration encryption, with GitHub mocked at the `fetch` level as the Integrations specs do. Add an option to `issues-http-db-harness.ts`, or a sibling `issues-canary-harness.ts`, that:

- imports the real Integrations providers instead of `FakeIntegrationsGithubService`;
- seeds integrations of every credential type with canary secrets: a PAT, an OAuth token, a GitHub App private key with an installation token, and a GitHub error body. Reuse `CANARY_PAT`, `CANARY_OAUTH_TOKEN`, `CANARY_INSTALLATION_TOKEN` and `CANARY` from `integrations/tests/support/integrations-github-harness.ts`, and add `CANARY_APP_KEY` and `CANARY_ERROR_BODY` there;
- scripts GitHub per test (success, `304`, `403` and `429` rate limit, `401`, `403` permission, `404` with a passing or failing probe, `5xx`) with response bodies that embed `CANARY_ERROR_BODY`;
- mounts the request-logging chain as `core/tests/request-logging.e2e-spec.ts` does (`LoggingModule`, `RequestContextMiddleware`, the logging interceptor) and captures every log line through `createConsoleSpies` and the `LoggerService`;
- keeps `FakeWorkersService` so every enqueue is recorded, with a helper that drains the queue by running the real `issues.reconcile` job inline, retries and cooldown exhaustion included;
- offers `expectNoCanary(haystacks: string[], canaries: string[])`, which serializes response bodies, headers, log lines and recorded job params and searches them.

Do not add any code path that lets Issues read a credential. The harness only wires the existing module boundary.

## Files to Change
- `backend/src/issues/tests/support/issues-canary-harness.ts`: new, or an option on `issues-http-db-harness.ts`.
- `backend/src/integrations/tests/support/integrations-github-harness.ts`: add `CANARY_APP_KEY` and `CANARY_ERROR_BODY`, and export a scripted `fetch` builder if it is not already reusable.
- `backend/src/issues/tests/support/canary-assertions.ts`: new; `expectNoCanary` and the serialization helpers.
