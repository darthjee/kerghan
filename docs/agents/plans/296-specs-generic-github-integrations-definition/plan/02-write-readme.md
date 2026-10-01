# Write `integrations/README.md`

Create `docs/agents/specs/integrations/README.md`, the feature overview and index:

- **Temporary-spec banner** — these specs are the source of truth for #295's sub-issues and are
  deleted by #304 once folded into the permanent docs (link `../../specs.md`).
- **What an integration is** — a labelled GitHub credential slot owned by a user, used only by
  the backend (never the browser); `provider` `github`; `type` `pat` | `oauth_app` |
  `github_app`; many per user; managed from the *Integrations* page in the "My account"
  dropdown.
- **Why** — private repos, per-credential rate limit (instead of the shared unauthenticated
  60 req/h), groundwork for backend proxying.
- **Product decision** — #295 lifts the `CLAUDE.md` "no GitHub credential storage" boundary
  **for integrations only**, as defined in this folder.
- **Scope** — in scope / out of scope lists from the issue (per-type details → #297/#298/#299,
  key rotation → #305, using integrations for issue fetching or linking repos → out, permanent
  doc rewrite → #304, non-GitHub providers → out, no implementation here).
- **Backward compatibility** — verbatim decisions from the issue: existing behaviour unchanged
  (issue fetching stays unauthenticated and frontend-side; login/refresh/device auth untouched;
  dropdown only gains an item; Navi unaffected), DB additive only with working `down`
  migrations, new required `KERGHAN_INTEGRATIONS_KEY` (boot fails if missing/malformed; must be
  set in every environment before #300 deploys; #300 adds it to docker-compose, `.env` samples,
  CI and `environment-variables.md`), no `/ready.json` check.
- **Future use (non-binding)** — backend proxy picking a user's "default" integration, or one per
  tracked repo; a 401 from GitHub may set `invalid`; admin support tooling (read-only metadata,
  deleting a leaked credential) as its own future issue. No fields added now.
- **Implementation issue map** — #300 reads `model.md`, `api.md`, `security.md`,
  `type-contract.md`; #301 reads `ui.md`, `api.md`; #302/#303 read `type-contract.md` + their
  type spec.
- **Index of files** — link `model.md`, `api.md`, `security.md`, `ui.md`, `type-contract.md`,
  and a `types/` subsection noting `pat.md` (#297), `oauth-app.md` (#298), `github-app.md`
  (#299) are added by those issues (plain text, not broken links, until they exist).

## Files to Change

- `docs/agents/specs/integrations/README.md` — new overview/index.
