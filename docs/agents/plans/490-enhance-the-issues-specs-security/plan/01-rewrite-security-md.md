# Rewrite security.md

Rewrite `docs/agents/specs/issues/security.md`, keeping the existing bullets that still hold (user scoping, credentials in the backend, sharing guardrails, E19 to E24, the link's `user_id` for uniqueness only) and adding the decided sections:

1. **Write access to GitHub**: the capability table by credential type; the GitHub App with Issues: write and Metadata: read, installations accepted on `read` or `write`; per-operation installation tokens (`getIssue`/`probeIssues` with `issues: read, metadata: read`, `updateIssue` with `issues: write`), cached by installation and permission set; reactive handling only (no `writeAccess` field, no warning at link creation); what works without write access; how a write-capable credential is obtained.
2. **The Integrations boundary**: `IntegrationsGithubService` stays `GET`-only; `IntegrationsGithubIssueWriter` holds `updateIssue`, injected only by the issues sync service; one endpoint, path from stored rows, body allowlist `title`/`body`/`state`, owner's credential; no automatic redirect, a `Location` off `https://api.github.com` sends no credential.
3. **Content**: titles as text; bodies as restricted Markdown per the rule table (raw HTML escaped, safe schemes only, images never loaded, disabled task checkboxes, no autolinking); one shared `IssueBody` component; `react-markdown` + `remark-gfm` installed through `docker-compose`; the link `url` rule; no content in logs, errors or `meta`; pushed `@mentions` notify on GitHub (documented).
4. **Data at rest**: no encryption, with the covered and not-covered exposure; project deletion hard-deletes issues, links and markers and clears the description, the project row staying as a tombstone.
5. **Quotas and limits**: the two caps (env vars, defaults, `409` codes, checked under the creation lock, import pre-check); the two rate limits (env vars, defaults, `429` codes, after DTO validation and before the access check); refresh and retry unlimited; mandatory per-link job dedupe.
6. **Logs and job params**: the allowlist table by source; no owner/name; refusals only in the access line; duplicate keys mapped to `409`, services log error class and driver code, never the message.
7. **Review checklist**: the eight `security` and seven `data-access` checks, with a pointer to #505.
8. **Not decided**: the deferred items listed in the plan's Notes.
9. **Open questions**: none owned by #490; the four existing ones are closed.
10. **Required tests**: every test listed in the issue's sections: writer fence `(static)`, body allowlist, redirect host check (contract and unit), token permissions per operation, rendering per rule (frontend unit and `(static)`), link `url` guard, content canary and credential canary, project deletion `(db)` and `(race)`, caps `(db)` and rate limits with `FakeClock`, per-link dedupe, duplicate-key mapping `(db)`, the access-line-only refusal, plus the existing E19 to E24 and single-access-check tests.

## Files to Change

- `docs/agents/specs/issues/security.md` — full rewrite as above.
