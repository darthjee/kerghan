# Update product, flow, overview, env-var docs and boundaries

- `docs/agents/product.md`:
  - Add the `Integration` entity: owned by one user, many per user, `provider`/`type`, label,
    status. Add the access rules (only the owner can see or manage an integration; secrets are
    never returned) and encrypted storage.
  - Rewrite the "What the backend persists" and "GitHub access" bullets. Integrations are
    persisted and are the only allowed GitHub credential storage. Issue data is still fetched
    unauthenticated and client-side.
  - In *Deferred*, replace the "Per-user GitHub token … In progress" bullet with **using**
    integration credentials (backend proxying and private-repo reading), which is still not
    built. Link to `modules/integrations.md`.
- `docs/agents/flow.md`: in the "per-user GitHub token planned" text (step ~26) and in
  "Deliberately deferred → Private repos via personal GitHub token", say that credentials can
  now be stored as integrations, but that issue fetching does not use them yet.
- `AGENTS.md`: update the intro (line ~7, "a per-user GitHub token … is planned") and the
  boundary bullet at ~103–105 so it links to `docs/agents/modules/integrations.md` instead of
  the spec README.
- `CLAUDE.md`: update the boundary "Store GitHub credentials only as integrations, exactly as
  defined in `docs/agents/specs/integrations/` (encrypted at rest per its `security.md`; …)" so
  it points at `docs/agents/modules/integrations.md` (encrypted at rest per its *Security*
  section). Keep its meaning: any other GitHub credential storage still needs an explicit
  product decision, and issue fetching is still unauthenticated.
- `docs/agents/summary.md`: add an **Integrations** entry under Modules, update the
  "`modules/auth.md` and `modules/mail.md` today" line, and update the "deferred (…
  private-repo GitHub tokens)" mention. Check whether `docs/agents/index.md` needs a change
  (it links `modules/` generically).
- `docs/agents/environment-variables.md`: repoint the links at lines ~27, ~88, ~117 and ~209
  to `modules/integrations.md#encryption-at-rest` (or `#key`),
  `modules/integrations/oauth-app.md#server-config` and
  `modules/integrations/github-app.md#server-config`. Make sure every integration env var
  (`KERGHAN_INTEGRATIONS_KEY`, OAuth App and GitHub App vars) is listed.

## Files to Change
- `docs/agents/product.md`
- `docs/agents/flow.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/agents/summary.md`
- `docs/agents/index.md`: only if needed
- `docs/agents/environment-variables.md`
