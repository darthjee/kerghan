# Folder Structure

## Project Root

| Path | Purpose |
|---|---|
| `backend/` | Node.js/NestJS app, TypeScript + TypeORM/MySQL (only the Auth module exists — the tracked-repo/label-rule data model is still open, see `docs/agents/product.md`) |
| `frontend/` | React 19 + Vite app — dashboard/analytics UI, currently a tooling-only skeleton |
| `proxy/` | PHP Tent proxy config (`dev_configuration/`, `prod_configuration/`, `extension/`) |
| `dockerfiles/` | One directory per built image, `-base`/leaf pairs |
| `docker_volumes/` | Bind-mount targets for local dev (gitignored contents) |
| `docs/agents/` | Agent-facing documentation, hub + per-topic pages (this directory) |
| `bin/` | Language-agnostic CI shell scripts (`image.sh`, `deploy_frontend.sh`) |
| `scripts/` | Release shell scripts (`bump_version.sh`, `deploy.sh`, `render.sh`, `wake_navi.sh`, `warm_navi_cache.sh`) |
| `.circleci/` | CI pipeline config |
| `.claude/agents/` | Specialist AI agent definitions |
| `.github/` | Commit/PR templates + `copilot-instructions.md` |
| `navi/` | Navi cache-warmer config |
| `Makefile` | Dev command interface |
| `docker-compose.yml` | Full stack service definitions |
| `version` | Base-image version registry |
| `.env.dev.sample`, `.env`, `.env.prod` | Environment variable files |

## `backend/` — Backend

| Subdirectory / File | Description |
|---|---|
| `src/main.ts` | Nest app bootstrap (cookie-parser, global `ValidationPipe`, `PORT`) |
| `src/app.module.ts` | Root module — see `docs/agents/architecture/backend.md` |
| `src/core/` | Core layer: JWT Guard, `@Public()` decorator, CacheToken service, `LazyModuleLoader` wrapper, `tests/` |
| `src/database/` | TypeORM `DataSource` config + `migrations/` (`<timestamp>-<module>-<action>.ts`) |
| `src/health/` | `GET /health.json` controller |
| `src/auth/` | Auth module — see `docs/agents/modules/auth.md` |
| `dist/` | Compiled build output (gitignored) |
| `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `jest.config.ts`, `package.json`, `eslint.config.mjs` | Tooling config |

## `frontend/` — Frontend

| Subdirectory / File | Description |
|---|---|
| `assets/js/` | React source code — currently just `App.jsx` (placeholder) + `main.jsx` (entry) |
| `specs/` | Jasmine test files, mirrors `assets/js/`; `specs/support/jsx-loader.mjs` runs JSX under Node |
| `index.html` | Vite HTML entry point |
| `vite.config.js`, `eslint.config.mjs`, `package.json` | Tooling config |

## `proxy/` — Tent Proxy

| Subdirectory / File | Description |
|---|---|
| `dev_configuration/` | Dev routing rules: `configure.php`, `locals.php`, `rules/{frontend,backend,redirects}.php` |
| `prod_configuration/` | Prod routing rules — same shape, host-specific vars via `locals.php.sample` |
| `extension/lib/` | Custom PHP middleware (`CacheControlMiddleware`, `SetClientIpMiddleware`, `TestHeaderMiddleware`) + `cache/DomainHash.php` — trimmed to backend-agnostic classes only, no upload/admin-staff code |
| `extension/tests/` | PHPUnit tests, mirrors `extension/lib/` |

## `docker_volumes/` — Mounted Volumes

| Subdirectory | Description |
|---|---|
| `mysql_data/` | MySQL data persistence |
| `node_modules/` | Frontend deps cache |
| `static/` | Frontend build output, served by the proxy |
| `proxy_cache/` | Tent's HTTP response cache |

## `.claude/agents/` — Claude Code Configuration

| File | Description |
|---|---|
| `architect.md` | Cross-cutting coordinator |
| `backend.md` | NestJS/TypeORM/Jest/ESLint |
| `infra.md` | docker-compose, Dockerfiles, CI, deploy scripts, Makefile |
| `frontend.md` | React/Vite/Jasmine/ESLint |
| `proxy.md` | Tent PHP proxy config + extension |
| `cache.md` | Navi cache-warmer config |
| `security.md` | Read-only security reviewer |
| `data-access.md` | Read-only access-control reviewer |
| `product-owner.md` | Read-only product-definitions reference |

## `docs/agents/` — Documentation

| Subdirectory / File | Description |
|---|---|
| `architecture/` | Per-area architecture pages (`proxy.md`, `frontend.md`, `backend.md`, `modular-pattern.md`, `infra.md`) |
| `modules/` | Per-backend-module documentation (routes, entities, events) — `auth.md` today |
| `plans/` | Implementation plans, one directory per issue |
| `issues/` | Detailed specs for open issues, one file per issue |
| `index.md`, `summary.md`, `folder-structure.md`, `flow.md`, `architecture.md`, `contributing.md`, `cache-warmer.md`, `product.md`, `issue-enhancement.md` | Top-level reference docs |

## `dockerfiles/` — Service Images

One directory per service image (dev and production backend, dev and production Vite, CircleCI
base), each with a `-base` variant shared by its dev/production counterpart where applicable.
See `ls dockerfiles/` for the current list. The backend image family (`kerghan-base`,
`circleci_kerghan-base`, `production_kerghan-base`) is built but not published to Docker Hub —
see `docs/agents/architecture/infra.md` for the CircleCI `release-image` jobs that publish each
image family (and which ones actually push to Docker Hub).
