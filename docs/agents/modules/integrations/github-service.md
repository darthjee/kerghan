# Integrations — GitHub service

What the Repositories module gets from the [Integrations module](../integrations.md): the exported
`IntegrationsGithubService`, the single GitHub client behind it, the `integration.deleted` event
and the rules for credentials that stop working. Part of the Integrations module.

## Summary

The Integrations module exports **`IntegrationsGithubService`** (from `IntegrationsModule`), with
fixed, `GET`-only operations and no generic `request(path)`: `listUsableIntegrations`,
`listIntegrations`, `listRepositories`, `listHandleRepositories`, `getRepository`, `getIssue` and
`probeIssues`. The one non-`GET` call, `updateIssue`, lives on the separate exported
**`IntegrationsGithubIssueWriter`** ([issues](github-service/issues.md)). Other modules
import it only through `integrations/integrations-github.public.ts`. Results are typed and
normalised, never a raw `Response`; the integration is always loaded scoped to the user. The full
signatures, result types, endpoints and GitHub App installation tokens are in
[API](github-service/api.md#exported-service).

## Pages

| Page | Read it when |
|------|--------------|
| [API](github-service/api.md) | You need the exported service, its signatures and results, the unauthenticated calls, the GitHub endpoints and parameters, or how GitHub App installation tokens are minted. |
| [Issues](github-service/issues.md) | You need the issue reads, the issue writer, per-operation token permissions, issue redirects or the issue contract specs. |
| [Status and errors](github-service/status-and-errors.md) | You need what happens on a `401` (invalid status, compare-and-set), which integrations are usable, or how GitHub errors map to results. |
| [Add and deletion](github-service/add-and-deletion.md) | You work on the Add flow (access link, re-check candidates, shared 502 / 503 helpers), the `integration.deleted` deletion hook, or the unauthenticated budget tracker. |
| [Required tests](github-service/required-tests.md) | You write or review the tests the GitHub service must have. |
