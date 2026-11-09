# Product, architecture, env, root files

Commit 3: fold the product and cross-cutting checklist items and reword the root files.

- **`product.md`:**
  - what the backend persists: the per-user snapshot of every GitHub repo seen, including private metadata and its bounded lifetime (the non-usable-integration exception), and an added private repo reading Unavailable only until the next link fill;
  - "What's still open": the tracked-repos data model is settled, and any descoped part is recorded here (step 01);
  - "Deferred → Using integration credentials": partly lifted, for repo listing only.
- **`flow.md`:** step 2 (discovery merges the handle's public repos and the integrations' repos, all fetched by the backend), step 3 (selection/Add) as built, and answer the "Open questions" item (on demand when stale, plus Refresh).
- **`architecture/security.md`:** a new **"GitHub credentials stay in the backend"** section, from `specs/repos/security.md#credentials-stay-in-the-backend`.
- **`architecture/backend.md`:**
  - `#error-responses`: the optional `error.retryAfterSeconds`;
  - `#testing`: the DB-backed tier (`*.db-spec.ts`, `yarn test:db`, serial, dedicated schema), replacing the "add a `cimg/mysql` service … when the first spec actually needs a real database" note;
  - `Clock` / `SyncLauncher` and the no-`NOW()` rule, only if step 01 decided to promote them.
- **`architecture/frontend.md`:** only if a frontend convention from `testing.md` generalised (e.g. the builders or the no-`api.github.com` spec); otherwise moot.
- **`architecture/infra.md`:** the MySQL CI job (`cimg/mysql:8.0` service, required by the release and deploy jobs).
- **`environment-variables.md`:** `KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW`, `KERGHAN_REPOSITORIES_ADD_WINDOW_MS`, `KERGHAN_REPOSITORIES_SYNC_TTL_MS`, `KERGHAN_REPOSITORIES_SYNC_COOLDOWN_MS`, `KERGHAN_REPOSITORIES_SYNC_PAGE_CAP`, with the built defaults.
- **`contributing.md`:** the ESLint boundary override, only if step 01 decided it affects contributors outside the module.
- **`cache-warmer.md`:** the Repositories routes and `POST /auth/account/mine.json` are user-scoped (`X-Skip-Cache`) and Navi does not warm them, if the doc lists such routes.
- **`AGENTS.md` / `CLAUDE.md`:**
  - reword the overview (around `AGENTS.md:11`), the note (around `AGENTS.md:108`) and the `CLAUDE.md` GitHub boundary: the backend lists repos inside the Integrations module (credential or the handle's public listing), and issue data is still fetched by the browser, unauthenticated;
  - add the "credentials stay in the backend" boundary to `CLAUDE.md`;
  - links stay on `docs/agents/specs.md` only.

## Files to Change

- `docs/agents/product.md`, `docs/agents/flow.md`
- `docs/agents/architecture/security.md`, `docs/agents/architecture/backend.md`, `docs/agents/architecture/infra.md` (and `architecture/frontend.md` if applicable)
- `docs/agents/environment-variables.md`, `docs/agents/cache-warmer.md` (and `docs/agents/contributing.md` if applicable)
- `AGENTS.md`, `CLAUDE.md`
