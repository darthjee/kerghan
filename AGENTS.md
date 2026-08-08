# Project Instructions

Kerghan is a GitHub issue monitoring/dashboard app. Users log in (no GitHub OAuth yet — just a
GitHub handle, with a per-user GitHub token for private repos planned as a future addition) and
choose which of their repos/orgs to monitor; that selection is what the backend persists. Issue
data itself is fetched live, on demand, by the frontend calling GitHub's public API directly —
each user's own browser IP absorbs GitHub's unauthenticated rate limit instead of the backend's
shared one. Nothing about issues is persisted to MySQL by default; opt-in persistence (for
history/trends) is a future addition, not the current behavior. The driving use case is
label-based attention triage — surfacing which of a user's many tracked repos "need my
attention". See [Flow](docs/agents/flow.md) for the full request/data flow and
[Product Definitions](docs/agents/product.md) for what's decided vs. still open.

## Stack

### Backend

- Node.js, ES Modules, Express
- Sequelize (ORM + `sequelize-cli` migrations)
- MySQL 8
- Yarn (package manager)
- Jasmine + c8 (tests and coverage)
- ESLint (linting, flat config)

No models exist yet — the tracked-repo/label-rule data model is still an open product decision
(see `docs/agents/product.md`).

### Frontend

- React 19
- Vite (build tool)
- Jasmine + c8 (tests and coverage)
- ESLint (linting)
- Yarn (package manager)

Currently a tooling-only skeleton — `App.jsx` is a placeholder shell.

### Infrastructure

- Docker + Docker Compose
- Reverse proxy via `darthjee/tent`
- Cache warmer via `darthjee/navi-hey`

## Development

```bash
# Start the full stack (proxy + backend + frontend)
make dev-up

# Open a backend shell
make dev

# Open a test shell
make tests

# Run Sequelize migrations
make setup
```

Backend runs on port `3030`, frontend dev server on `3010`, full stack proxy on `3000`.

**Always run project commands through `docker-compose`.** (unless the user says otherwise).
Never install packages or invoke tooling (`yarn`, `npm`, `php`, etc.) directly on the host
machine (unless the user says otherwise). The host may not even have the required runtime
installed, and dependencies must stay reproducible inside the project's containers. Examples:

```bash
docker-compose run --rm kerghan_fe yarn lint
docker-compose run --rm kerghan_tests yarn test
```

## Conventions

- All documentation and code comments must be written in **English**.
- Backend code lives in `backend/`, frontend in `frontend/`.
- Backend source lives under `backend/lib/` (`server/`, `exceptions/`, and eventually domain
  classes); Sequelize models/migrations/seeders live under `backend/models/`,
  `backend/migrations/`, `backend/seeders/`.
- Frontend JS/JSX lives under `frontend/assets/js/`, specs under `frontend/specs/`.
- Max 300 lines per file, max complexity 10 (both backend and frontend, ESLint-enforced).
- Keep backend routes/handlers thin — business logic belongs in domain classes.
- The backend image family (`kerghan`, `circleci_kerghan-base`, `production_kerghan-base`) is
  **not published to Docker Hub** — built locally / in CI only. Only the frontend/proxy
  (`vite_kerghan*`) images are published.
- Kerghan has a lightweight per-user account/login (not GitHub OAuth) — see
  [Flow](docs/agents/flow.md). GitHub data itself is still read unauthenticated (public-repo
  only) for now; a per-user GitHub token for private-repo access is planned but not built. Don't
  add GitHub credential storage without an explicit product decision backing it.

## Documentation

All project documentation lives under [`docs/agents/`](docs/agents/):

| File | Contents |
|------|----------|
| [Index](docs/agents/index.md) | Link-only table of contents for `docs/agents/` — fetch this first to navigate the doc set. |
| [Summary](docs/agents/summary.md) | 2-4 line abstract of each doc under `docs/agents/`, to decide whether to open the full file. |
| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |
| [Flow](docs/agents/flow.md) | End-to-end request/data flow: login, repo selection, on-demand issue fetching. |
| [Architecture](docs/agents/architecture.md) | Hub page linking to per-area architecture pages (`proxy`, `frontend`; `backend` not written yet). |
| [Contributing](docs/agents/contributing.md) | Commit guidelines, PR standards, code organization, and refactoring rules. |
| [Product Definitions](docs/agents/product.md) | Stub — restates what's decided vs. still open about Kerghan's data model. Consult before planning any issue that introduces new entities. |
| [Cache Warmer](docs/agents/cache-warmer.md) | Navi setup for warming the proxy cache after release (CI and local); used by the `cache` agent. |
| [Plans](docs/agents/plans/) | Implementation plans for ongoing or upcoming features. |
| [Issues](docs/agents/issues/) | Detailed specs for open issues. |
| [Issue Enhancement](docs/agents/issue-enhancement.md) | Checklist of concerns used by `/enhance-issue` to flesh out vague issue ideas. |

### Issues (`docs/agents/issues/`)

Each file documents an issue in detail. Naming convention:

```
docs/agents/issues/<issue_id>_<issue_name>.md
```

### Plans (`docs/agents/plans/`)

Each plan is a directory named after the issue ID and topic, containing one or more related
files:

```
docs/agents/plans/<issue_id>_<topic>/<related_files>.md
```

## Specialist agents

See `.claude/agents/` for the full roster (`architect`, `infra`, `frontend`, `proxy`, `cache`,
`security`, `data-access`, `product-owner`). There is no `backend` agent yet — see
`.claude/agents/architect.md` for why and what to do in the meantime.
