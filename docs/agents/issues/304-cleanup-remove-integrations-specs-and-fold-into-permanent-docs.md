# Issue: Cleanup: remove integrations specs and fold into permanent docs

## Description
Final sub-issue of #295 (GitHub integrations). A user registers one or more **integrations**: GitHub credentials (`provider: github`, `type`: `pat`, `oauth_app` or `github_app`) that Kerghan's backend, never the browser, will later use on their behalf. Users manage them from the **Integrations** page in the "My account" dropdown. Integrations are now built (#300–#303), so the temporary spec folder `docs/agents/specs/integrations/` (~2,600 lines across 9 files) must be folded into the permanent docs and deleted, following the lifecycle in `docs/agents/specs.md`.

## Problem
- `docs/agents/specs/integrations/` is a temporary spec meant to be deleted by the feature's last sub-issue.
- Permanent docs still call per-user GitHub credentials *Deferred* / "planned" and point at the temporary spec: `product.md`, `flow.md`, `AGENTS.md`, `summary.md`, `environment-variables.md`.
- The `CLAUDE.md` boundary and `AGENTS.md` point at `docs/agents/specs/integrations/`, which is about to disappear.
- About 35 code comments in `backend/src/integrations/**`, the integrations migration and `frontend/assets/js/**` cite spec paths and anchors, e.g. `specs/integrations/security.md#access-rules`.

## Expected Behavior
- The lasting definitions of integrations live in permanent docs:
  - `docs/agents/product.md`: the `Integration` entity, ownership and access rules. Credential storage moves out of *Deferred*. Private-repo issue reading and backend proxying stay deferred, because issue fetching is still unauthenticated.
  - New `docs/agents/modules/integrations.md`: overview of the module, the data model, security (encryption at rest, access rules, cooldowns, secrets never logged), the type contract, and a short **Frontend** section for the Integrations page and type picker.
  - New `docs/agents/modules/integrations/pat.md`, `oauth-app.md` and `github-app.md`: one file per type, covering its flow, state, revocation, server config and frontend landing/selection behavior.
  - New `docs/agents/backend/routes/integrations.md`: the endpoints, mirroring `backend/routes/auth.md` and linked from `backend/routes.md`.
  - `docs/agents/environment-variables.md`: every integration env var, with no links to the spec.
  - `docs/agents/flow.md`, `AGENTS.md`, `docs/agents/index.md` / `summary.md`: they say credentials can be stored as integrations, while GitHub issue data is still read unauthenticated.
- The `CLAUDE.md` boundary keeps its meaning: GitHub credentials are stored only as integrations, encrypted at rest, and any other storage needs a product decision. It now points at the permanent docs.
- `docs/agents/specs/integrations/` is deleted.
- `docs/agents/specs.md` still exists and is linked from `docs/agents/index.md`. Its **Active specs** list reads "none".
- No file in the repo references `docs/agents/specs/integrations` except historical files under `docs/agents/issues/` and `docs/agents/plans/`. That includes code comments, which are repointed to the new permanent docs and their anchors.

## Solution
- **Architect**: `product.md`, the new `modules/integrations.md`, `modules/integrations/*.md` and `backend/routes/integrations.md`, plus `backend/routes.md`, `environment-variables.md`, `flow.md`, `AGENTS.md`, `index.md` / `summary.md`, `CLAUDE.md` and `specs.md`. Delete the spec folder.
- Spec content maps roughly as follows. `README.md`, `model.md`, `security.md`, `type-contract.md` and `ui.md` go to `modules/integrations.md`. `api.md` goes to `backend/routes/integrations.md`. Each `types/*.md` goes to `modules/integrations/*.md`.
- **Backend**: repoint the spec-path comments in `backend/src/integrations/**` and the integrations migration to the new docs' anchors. Comments only, no behavior change.
- **Frontend**: the same for `frontend/assets/js/**`.
- Spec-only material is dropped rather than folded: the "Required tests" sections and the temporary-spec framing.
- **Verification**:
  - Grep finds no `docs/agents/specs/integrations` outside `docs/agents/issues/` and `docs/agents/plans/`.
  - The markdown lint passes.
  - Backend and frontend lint pass.
  - The product-owner agent confirms that `product.md` matches what was built.

## Benefits
- One permanent source of truth for integrations, so readers don't have to go through a temporary spec.
- The product docs and the `CLAUDE.md` boundary match what is actually built.
- The spec lifecycle in `docs/agents/specs.md` gets its first full run.
