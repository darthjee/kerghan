# Plan: Cleanup: remove integrations specs and fold into permanent docs

Issue: [304-cleanup-remove-integrations-specs-and-fold-into-permanent-docs.md](../../issues/304-cleanup-remove-integrations-specs-and-fold-into-permanent-docs.md)

## Overview

Fold the lasting content of the temporary `docs/agents/specs/integrations/` spec (#295) into
permanent docs, then delete the spec folder. The architect writes the new docs: a
`modules/integrations.md` overview, one file per type under `modules/integrations/`, and a
`backend/routes/integrations.md` endpoint reference. The architect also updates `product.md`,
`flow.md`, `AGENTS.md`, `summary.md`, `environment-variables.md`, `CLAUDE.md` and `specs.md`.
The backend and frontend agents repoint their code comments from spec paths to the new
anchors. This is a comment-only change with no behavior change.

## Agents involved

- [architect](architect.md)
- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

### New doc files and anchors

The architect must create these headings exactly as written, so that GitHub generates the
anchors listed. The backend and frontend comments must cite exactly these anchors.

| Old spec reference | New reference |
|---|---|
| `specs/integrations/` (folder) | `docs/agents/modules/integrations.md` |
| `specs/integrations/model.md` | `docs/agents/modules/integrations.md#data-model` |
| `specs/integrations/model.md#integrations-columns` | `docs/agents/modules/integrations.md#integrations-columns` (`### \`integrations\` columns`) |
| `specs/integrations/model.md#owner-foreign-key` | `docs/agents/modules/integrations.md#owner-foreign-key` |
| `specs/integrations/security.md#access-rules` | `docs/agents/modules/integrations.md#access-rules` |
| `specs/integrations/security.md#secrets-never-logged` | `docs/agents/modules/integrations.md#secrets-never-logged` |
| `specs/integrations/security.md#create-and-replace-credential-failure-cool-off` | `docs/agents/modules/integrations.md#create-and-replace-credential-failure-cool-off` |
| `specs/integrations/security.md#test-connection-cooldown` | `docs/agents/modules/integrations.md#test-connection-cooldown` |
| `specs/integrations/type-contract.md` | `docs/agents/modules/integrations.md#type-contract` |
| `specs/integrations/api.md` | `docs/agents/backend/routes/integrations.md` |
| `specs/integrations/api.md#integration-response` | `docs/agents/backend/routes/integrations.md#integration-response` |
| `specs/integrations/api.md#per-action-behaviour` | `docs/agents/backend/routes/integrations.md#per-action-behaviour` |
| `specs/integrations/types/pat.md` | `docs/agents/modules/integrations/pat.md` |
| `specs/integrations/types/oauth-app.md[#x]` | `docs/agents/modules/integrations/oauth-app.md[#x]`, with the same anchors: `#flow`, `#routes`, `#landing`, `#state`, `#revocation`, `#validate--create` |
| `specs/integrations/types/github-app.md[#x]` | `docs/agents/modules/integrations/github-app.md[#x]`, with the same anchors: `#flow`, `#routes`, `#landing`, `#selection`, `#state`, `#user-token` |

## Notes

- Historical files under `docs/agents/issues/` and `docs/agents/plans/` are exempt from the
  "no references remain" check.
- Final check:
  `git grep -n "specs/integrations" -- . ':!docs/agents/issues' ':!docs/agents/plans'` returns
  nothing. Use `git grep` so that untracked `coverage/` reports are ignored.
