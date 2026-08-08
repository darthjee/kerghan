# Kerghan — Infrastructure Bootstrap

This document hands a future AI (working inside the **Kerghan** repository, with read access
back into this `majora-2` checkout) everything needed to stand up Kerghan's infrastructure from
day one, modeled on Majora's own. It is a **bootstrap/reference document**, not application
code.

Sections still marked **🚧 TODO** are genuinely open — don't try to resolve them from this doc
alone. Everything else has been decided (see §21 for the full backend decision log) — treat those
as settled rather than re-litigating them. Every `See majora-2/<path>` reference assumes the
reading AI has filesystem access to this `majora-2` folder alongside the new `kerghan` repo; every
`See navi/<path>` reference (§20) assumes the same for this `navi` checkout.

Snippets below are either embedded in full (when short/structural and worth having inline) or
referenced by path (when long or highly repetitive) — always with a short note on what to
rename for Kerghan. The recurring rename pattern is:

| Majora | Kerghan |
|---|---|
| `majora_*` (compose service prefix) | `kerghan_*` |
| `darthjee/majora`, `darthjee/vite_majora*` (image names) | `darthjee/kerghan`, `darthjee/vite_kerghan*` |
| `MAJORA_*` (env var prefix) | `KERGHAN_*` |
| `PROJECT?=majora` (Makefile) | `PROJECT?=kerghan` |

This assumes Kerghan reuses the same Docker Hub namespace/GitHub owner (`darthjee`) and starts
from the same `darthjee/tent`/`darthjee/navi-hey` image versions as Majora — a low-stakes
default, swap it if Kerghan needs its own namespace or newer image versions.

---

## 1. About Kerghan (product context)

This section exists so the backend AI — who won't have the conversation that produced this
document — understands **what it's building**, not just how to wire it up.

**What it is.** Kerghan is a GitHub issue monitoring/dashboard app. Users register the repos
(and/or orgs) they care about; Kerghan polls/aggregates their issues into MySQL so they can be
queried and visualized without going back to GitHub for each check.

**Core value.** Label-based attention triage: the driving use case is surfacing which of the
user's many projects "need my attention" by watching for issues carrying certain labels, across
every repo they track, in one place — instead of manually checking each repo's issue tracker.

**Multi-tenant.** Unlike Majora (a personal RPG tool with no accounts model beyond
staff/players), Kerghan is **multi-tenant and user-configurable**: each user account registers
its own set of repos/orgs to monitor and, presumably, its own label rules/filters. Some of the
backend design consequences this raises have been decided (see §21 for the full rationale);
what's still open is left for the backend AI (and later a `docs/agents/product.md`) to resolve:

- ~~How GitHub access is obtained per user~~ — **decided:** none needed. For now Kerghan only
  reads **public** repo/issue data, via GitHub's REST API **unauthenticated**. No per-user
  credentials, no OAuth flow, nothing to store securely. Caveat worth carrying forward: GitHub's
  unauthenticated rate limit is **60 requests/hour per source IP**, shared across every Kerghan
  user polling from this one server — see §21 for how the polling model works around that. Revisit
  this decision (OAuth App / PAT / GitHub App) only if/when private-repo access is ever needed.
- How a user's tracked repos/orgs and label rules are modeled and scoped per account — still
  open, a `docs/agents/product.md` decision.
- ~~How polling is scheduled per user/repo~~ — **decided:** no scheduled/background polling for
  now. Issue data is fetched on-demand (when a user views a tracked repo) and cached in MySQL;
  see §21.

**Frontend surface.** The React frontend is a dashboard/analytics view — issue volume, age,
label breakdowns, "needs attention" lists — not just CRUD forms over issues. This matters for
the backend's API design: endpoints should be aggregation-friendly (counts, groupings, filtered
views), not only single-resource CRUD.

This section captures product *intent* as given at bootstrap time. The exact data model,
entities, and API shape are still open. Once decided, mirror Majora's separation of concerns and
write them up in Kerghan's own `docs/agents/product.md` (see `docs/agents/product.md` in
majora-2 for the shape such a doc should take: entity definitions, ownership chain, role
definitions, editing rules) — keep product decisions out of this infrastructure doc.

---

## 2. How to use this document

Read section by section, or jump to whichever concern you're bootstrapping. Infra pieces
(compose, proxy, CI, deploy, frontend build) are largely backend-language-agnostic and can be
copied with light renaming. Backend-specific pieces still flagged 🚧 are sketched only as
"what majora did, and what pattern to mirror" — the Node stack itself is now decided (§3, §21),
but the actual Dockerfiles/CI jobs/migrations built on top of it still need writing.

---

## 3. Stack

| Layer | Majora | Kerghan |
|---|---|---|
| Backend | Python 3.11, Django 5 + DRF, Gunicorn, Poetry | Node.js, ES Modules, Express, Yarn — mirrors Navi's own stack (§20); DB access via Sequelize (§21) |
| Frontend | React 19 + React Bootstrap 5, Vite, Jasmine + c8, ESLint, Yarn | Same — reuse as-is |
| Database | MySQL 8 (image: `mysql:9.3.0`) | Same |
| Reverse proxy | `darthjee/tent` (PHP) | Same |
| Cache warmer | `darthjee/navi-hey` (Navi) | Same, once API endpoints exist |
| CI | CircleCI | Same |
| Deployment | Render.com (backend app) + SSH/rsync host (proxy + static assets) | Same, pending Kerghan's own Render service / SSH host |

---

## 4. Top-level repo layout

Modeled on `docs/agents/folder-structure.md` in majora-2:

| Path | Purpose |
|---|---|
| `backend/` | Node.js/Express app, plain JS + Sequelize (equivalent of majora's `backend/games/` Django app) — see §20/§21 |
| `frontend/` | React 19 + Vite app — reuse majora's structure directly |
| `proxy/` | PHP Tent proxy config (`dev_configuration/`, `prod_configuration/`, `extension/`) — reusable almost verbatim |
| `dockerfiles/` | One directory per built image, `-base`/leaf pairs (see §6) |
| `docker_volumes/` | Bind-mount targets for local dev (gitignored contents, see §11) |
| `docs/agents/` | Agent-facing documentation, hub + per-topic pages (see §18) |
| `bin/` | Language-agnostic CI shell scripts (`image.sh`, `deploy_frontend.sh`) — reusable as-is |
| `scripts/` | Release shell scripts (`bump_version.sh`, `deploy.sh`, `render.sh`, `wake_navi.sh`, `warm_navi_cache.sh`) — reusable, minor path edits |
| `.circleci/` | CI pipeline config (see §8) |
| `.claude/agents/` | Specialist AI agent definitions (see §18) |
| `.github/` | Commit/PR templates + `copilot-instructions.md` (see §19) |
| `navi/` | Navi cache-warmer config (see §12) |
| `Makefile` | Dev command interface (see §9) |
| `docker-compose.yml` | Full stack service definitions (see §5) |
| `version` | Base-image version registry (see §14) |
| `.env.dev.sample`, `.env`, `.env.prod` | Environment variable files (see §10) |

---

## 5. Docker Compose

Full reference: `majora-2/docker-compose.yml`. Adapted skeleton for Kerghan:

```yaml
version: '3.8'

services:
  kerghan_mysql:
    image: mysql:9.3.0
    container_name: kerghan_mysql
    env_file: .env
    environment:
      MYSQL_DATABASE: kerghan
      MYSQL_USER: kerghan
      MYSQL_PASSWORD: kerghan
      MYSQL_ROOT_PASSWORD: kerghan
    ports:
      - 0.0.0.0:$KERGHAN_MYSQL_PORT:3306
    volumes:
      - ./docker_volumes/mysql_data:/var/lib/mysql

  #################### Base (Node build — Express + Yarn, see §6/§20) ####################

  base: &base
    image: darthjee/kerghan   # local tag only — not pushed to Docker Hub, see §20
    volumes:
      - ./backend:/home/node/app   # darthjee/node base image convention (user "node"), not majora's "app"
    links:
      - kerghan_mysql:mysql
    env_file: .env

  base_build:
    <<: *base
    build:
      context: .
      dockerfile: dockerfiles/kerghan/Dockerfile
    command: echo done

  base_prod: &base_prod
    image: darthjee/production_kerghan
    links:
      - kerghan_mysql:mysql
    env_file: .env.prod

  base_prod_build:
    <<: *base_prod
    build:
      context: .
      dockerfile: dockerfiles/production_kerghan/Dockerfile
    command: echo done

  #################### DEV CONTAINERS ####################

  kerghan_app:
    <<: *base
    container_name: kerghan_app
    depends_on:
      - base_build
      - kerghan_mysql
      - kerghan_phpmyadmin
    ports:
      - 0.0.0.0:3030:8080
    environment:
      - KERGHAN_MYSQL_PORT=3306

  kerghan_tests:
    <<: *base
    container_name: kerghan_tests
    depends_on:
      - base_build

  kerghan_prod_app:
    <<: *base_prod
    container_name: kerghan_prod_app
    depends_on:
      - base_prod_build
      - kerghan_mysql
    ports:
      - 0.0.0.0:3030:8080
    environment:
      - KERGHAN_MYSQL_PORT=3306
      - STAGE=production

  kerghan_fe:
    container_name: kerghan_fe
    build:
      context: .
      dockerfile: dockerfiles/vite_kerghan/Dockerfile
    volumes:
      - ./frontend:/home/node/app
      - ./docker_volumes/node_modules:/home/node/app/node_modules
      - ./docker_volumes/static:/home/node/app/dist
    ports:
      - 0.0.0.0:3010:8080
    env_file: .env

  kerghan_proxy:
    image: darthjee/tent:0.10.1
    container_name: kerghan_proxy
    env_file: .env
    volumes:
      - ./docker_volumes/static/:/var/www/html/static/
      - ./proxy/dev_configuration:/var/www/html/configuration/
      - ./docker_volumes/proxy_cache:/var/www/html/cache/
      - ./proxy/extension:/var/www/html/extension
    links:
      - kerghan_app:backend
      - kerghan_fe:frontend
    depends_on:
      - kerghan_app
      - kerghan_fe
    ports:
      - 0.0.0.0:3000:80

  proxy_tests:
    image: darthjee/tent-test:0.10.0
    volumes:
      - ./proxy/extension:/var/www/html/extension
    command: vendor/bin/phpunit --bootstrap /var/www/html/extension/tests/bootstrap.php /var/www/html/extension/tests

  kerghan_navi:
    image: darthjee/navi-hey:1.5.1
    volumes:
      - ./navi/:/home/node/app
    command: navi-hey --config navi_config.yaml
    environment:
      - KERGHAN_PRODUCTION_URL=$KERGHAN_PRODUCTION_URL
      - NAVI_PORT=3000
      - NAVI_NAMEPACE=$NAVI_NAMEPACE
    ports:
      - 0.0.0.0:3100:3000

  kerghan_phpmyadmin:
    image: phpmyadmin/phpmyadmin
    container_name: kerghan_phpmyadmin
    depends_on: [kerghan_mysql]
    links:
      - kerghan_mysql:mysql
    environment:
      PMA_HOST: mysql
      PMA_PORT: 3306
      MYSQL_USER: root
      MYSQL_ROOT_PASSWORD: kerghan
      MYSQL_PASSWORD: kerghan
    ports:
      - 0.0.0.0:3050:80
```

Notes on patterns to keep:
- **YAML anchors** (`&base`, `<<: *base`) share config between the dev app, the test runner, and
  their "build-only" shadow services (`base_build`, `base_prod_build`) whose sole job is
  `command: echo done` — this builds the image via `docker-compose build`/`run` without starting
  a real process.
- **Links** (not just the default network) alias service hostnames: `kerghan_mysql:mysql`,
  `kerghan_app:backend`, `kerghan_fe:frontend`. The proxy config refers to `http://backend:8080`
  / `http://frontend:8080` using these aliases — keep this convention so `proxy/` needs no
  changes.
  Photo/file upload volumes (`photos/`, `files/`) were dropped from this skeleton since Kerghan
  currently has no attachment-storage need — add them back if that changes (see §11).
- No `networks:`/`volumes:` top-level sections — everything is bind-mounted under
  `./docker_volumes/...`.

---

## 6. Dockerfiles

Full reference: `majora-2/dockerfiles/`. The shared convention across every image is a
**3-stage build**: `base` (pulls a pre-built `darthjee/<lang>` image, copies only the
dependency manifest for cache-friendliness) → `builder` (copies in a shared builder script from
the `darthjee/scripts` utility image and runs it to populate a package-manager cache) → final
image (copies just that populated cache back in, keeping the image lean). This "base image with
just deps" + "leaf image with deps + source" split repeats for dev and CI/production variants.

**Frontend — fully reusable, rename only.** `dockerfiles/vite_majora-base/Dockerfile`:

```dockerfile
FROM darthjee/scripts:0.8.0 as scripts
FROM darthjee/node:0.2.1 as base

USER root
RUN apt-get update && apt-get install -y rsync && rm -rf /var/lib/apt/lists/*
USER node

COPY --chown=node:node \
  ./frontend/package.json frontend/yarn.lock \
  /home/node/app/

######################################

FROM base as builder

ENV HOME_DIR /home/node

USER root
COPY --chown=node:node --from=scripts /home/scripts/builder/yarn_builder.sh /usr/local/sbin/yarn_builder.sh
RUN /bin/bash yarn_builder.sh

#######################
# FINAL IMAGE
FROM base
ENV HOME_DIR /home/node

COPY --chown=node:node --from=builder /home/node/yarn/new/ /usr/local/share/.cache/yarn/v6/

USER node

CMD ["npm", "run", "server"]
```

`dockerfiles/vite_majora/Dockerfile` (extends the base above, used by the `kerghan_fe` compose
service):

```dockerfile
FROM darthjee/scripts:0.8.0 as scripts
FROM darthjee/vite_kerghan-base:latest as base

COPY --chown=node:node \
  ./frontend/package.json frontend/yarn.lock \
  /home/node/app/

######################################

FROM base as builder

ENV HOME_DIR /home/node

USER root
COPY --chown=node:node --from=scripts /home/scripts/builder/yarn_builder.sh /usr/local/sbin/yarn_builder.sh
RUN /bin/bash yarn_builder.sh

#######################
# FINAL IMAGE
FROM base
ENV HOME_DIR /home/node

COPY --chown=node:node --from=builder /home/node/yarn/new/ /usr/local/share/.cache/yarn/v6/

USER node
```

Rename to `dockerfiles/vite_kerghan-base/Dockerfile` and `dockerfiles/vite_kerghan/Dockerfile`,
swap the `FROM darthjee/vite_kerghan-base:latest` line accordingly. There is **no production
Node process for the frontend** — in production, static assets are built once in CI and
rsync-uploaded to the proxy host, which serves them statically (see §13).

**Backend — stack decided (Express + Yarn, §21), Dockerfiles still to be written.** Majora's
backend base Dockerfile (`dockerfiles/majora-base/Dockerfile`) shows the shape to mirror with a
`yarn_builder.sh` step instead of `poetry_builder.sh` — but prefer copying §20's
`navi/dockerfiles/dev_app/Dockerfile` directly, since it's already the Node/Yarn version of this
exact pattern rather than a Python one to translate:

```dockerfile
FROM darthjee/scripts:0.8.0 as scripts
FROM darthjee/django:0.0.2 as base

CMD ["bin/server.sh"]

######################################

FROM base as builder

COPY --chown=app:app \
  ./backend/pyproject.toml ./backend/poetry.lock* \
  /home/app/app/

ENV HOME_DIR /home/app

USER app
COPY --chown=app:app --from=scripts /home/scripts/builder/poetry_builder.sh /usr/local/sbin/poetry_builder.sh
RUN /bin/bash poetry_builder.sh

#######################
# FINAL IMAGE
FROM base
ENV HOME_DIR /home/app

COPY --chown=app:app --from=builder /home/app/poetry/new/ /home/app/.cache/pypoetry/artifacts/
USER app
```

For Kerghan, the backend AI needs to produce: `dockerfiles/kerghan-base/Dockerfile` (deps-only,
`FROM darthjee/node:...`, copies `package.json`/`yarn.lock`, runs `yarn_builder.sh` — see §20's
dev-image reference for the exact shape), `dockerfiles/kerghan/Dockerfile` (dev leaf image), and
the production/CI variants (`dockerfiles/production_kerghan-base/`, `dockerfiles/production_kerghan/`,
`dockerfiles/circleci_kerghan-base/`) mirroring Majora's four-Dockerfile backend set — **none of
these get pushed to Docker Hub** (§20: local-build-only decision), so drop the corresponding
`push`/`push-base` Makefile targets and CI `release-image` job (§8/§9) for this image only. The
production Dockerfile should `COPY` the built `backend/` source into the final stage (not
`npm install -g` a published package — see §20's warning about not copying Navi's own production
Dockerfile verbatim). No custom Dockerfile is needed for MySQL (`mysql:9.3.0` used as-is) or the
proxy (`darthjee/tent:0.10.1` used as-is — Majora supplies proxy *configuration*, not a custom
image, see §7).

---

## 7. Proxy (Tent)

Tent ([darthjee/tent](https://github.com/darthjee/tent)) is a small PHP reverse proxy/static
file server. This layer is **backend-language-agnostic** — it just proxies to
`http://backend:8080` and `http://frontend:8080` by container link alias — so it's reusable
almost verbatim for Kerghan.

Folder layout (`majora-2/proxy/`):

```
proxy/
├── dev_configuration/
│   ├── configure.php          # entry point, loads rules in order
│   ├── locals.php             # dev-only local overrides
│   └── rules/
│       ├── backend.php        # proxy *.json to backend, with cache middlewares
│       ├── cache.php          # cache size/disk admin endpoints
│       ├── frontend.php       # dev: proxy to Vite; prod: serve static dist
│       └── redirects.php      # catch-all SPA hash-route redirect (loaded last)
├── prod_configuration/
│   ├── configure.php
│   ├── locals.php.sample      # real locals.php is gitignored, created on prod servers only
│   └── rules/                 # same files as dev
└── extension/                 # custom PHP classes extending Tent + PHPUnit test suite
```

Decided (§21): Kerghan has no admin UI, so `admin.php` is dropped entirely rather than adapted —
don't create it.

`configure.php` just `require_once`s rule files in order — **order matters**, later rules act as
catch-alls:

```php
<?php
require_once __DIR__ . '/locals.php';

require_once __DIR__ . '/rules/frontend.php';
require_once __DIR__ . '/rules/backend.php';
require_once __DIR__ . '/rules/redirects.php';   // must stay last
```

Frontend rule (dev/prod toggle via `FRONTEND_DEV_MODE`), reusable verbatim:

```php
<?php
use Tent\Configuration;

if (getenv('FRONTEND_DEV_MODE') === 'true') {
    // Development mode: forward to the Vite server (HMR)
    Configuration::buildRule([
        'handler' => [
            'type' => 'proxy',
            'host' => 'http://frontend:8080'
        ],
        'matchers' => [
            ['method' => 'GET', 'uri' => '/', 'type' => 'exact'],
            ['method' => 'GET', 'uri' => '/assets/js/', 'type' => 'begins_with'],
            ['method' => 'GET', 'uri' => '/assets/css/', 'type' => 'begins_with'],
            ['method' => 'GET', 'uri' => '/assets/images/', 'type' => 'begins_with'],
            ['method' => 'GET', 'uri' => '/@vite/', 'type' => 'begins_with'],
            ['method' => 'GET', 'uri' => '/node_modules/', 'type' => 'begins_with'],
            ['method' => 'GET', 'uri' => '/@react-refresh', 'type' => 'exact'],
        ]
    ]);
} else {
    // Production mode: serve static files from docker_volumes/static/
    Configuration::buildRule([
        'handler' => ['type' => 'static', 'location' => '/var/www/html/static'],
        'matchers' => [['method' => 'GET', 'uri' => '/assets', 'type' => 'begins_with']],
        'middlewares' => [[
            'class' => 'Tent\Middlewares\CacheControlMiddleware',
            'maxAgeSeconds' => 60 * 60 * 24
        ]]
    ]);
    Configuration::buildRule([
        'handler' => ['type' => 'static', 'location' => '/var/www/html/static'],
        'matchers' => [['method' => 'GET', 'uri' => '/', 'type' => 'exact']],
        'middlewares' => [
            ['class' => 'Tent\Middlewares\SetPathMiddleware', 'path' => '/index.html'],
            ['class' => 'Tent\Middlewares\CacheControlMiddleware', 'maxAgeSeconds' => 60 * 60 * 24]
        ]
    ]);
}
```

Backend rule — decided (§21): Kerghan keeps Majora's `*.json`-suffix convention as-is rather than
switching to an `/api/` prefix, so this rule needs no matcher changes:

```php
<?php
use Tent\Configuration;

Configuration::buildRule([
    'handler' => [
        'type' => 'default_proxy',
        'host' => 'http://backend:8080',
        'skip_cache_header' => 'X-Skip-Cache'
    ],
    'matchers' => [
        ['uri' => '.json', 'type' => 'ends_with']   // kept as-is — decided in §21
    ],
    'middlewares' => [
        ['class' => 'Tent\\Middlewares\\SetClientIpMiddleware'],
        [
            'class'    => 'Tent\\Middlewares\\CacheCleanupMiddleware',
            'location' => $cacheFolder,
            'clear'    => ['collection', 'entity']
        ],
        [
            'class' => 'Tent\\Middlewares\\CacheStalenessMiddleware',
            'location' => $cacheFolder,
            'host' => 'http://backend:8080',
            'maxAgeSeconds' => 10
        ]
    ]
]);
```

Catch-all redirect (loaded last), reusable verbatim:

```php
<?php
use Tent\Configuration;

Configuration::buildRule([
    'handler' => ['type' => 'default_proxy', 'host' => 'http://backend:8080'],
    'matchers' => [
        ['method' => 'GET', 'pattern' => '/^\/(?!#\/)/', 'type' => 'regex'],
    ],
    'middlewares' => [[
        'class' => 'Tent\Middlewares\RedirectMiddleware',
        'pattern' => '/^(\/.*)$/',
        'replacement' => '/#$1'
    ]]
]);
```

The `X-Skip-Cache` response header bypasses the Tent cache entirely — only apply caching
(the default) to routes that serve identical content to all clients; anything user-scoped
(which, given Kerghan's multi-tenant nature, is most endpoints) needs `X-Skip-Cache` set by the
backend or must be excluded from caching middleware.

Decided (§21): no GitHub webhook ingress route for now — Kerghan pulls on-demand rather than
reacting to pushed events, and unauthenticated access to arbitrary public repos wouldn't support
webhook registration anyway (that needs repo-admin setup per repo). Revisit if/when push-based
updates become worth the added GitHub-auth surface.

Custom PHP extension code (middlewares/handlers not covered above) lives in
`proxy/extension/lib/`, tested via `proxy/extension/tests/` (PHPUnit, run through the
`proxy_tests` compose service). Full reference on Tent's rule/middleware/handler system:
`majora-2/docs/agents/external/HOW_TO_USE_DARTHJEE-TENT.md` (hub, links to per-topic pages under
`docs/agents/external/tent/`) and `majora-2/docs/agents/architecture/proxy.md`.

---

## 8. CI (CircleCI)

Full reference: `majora-2/.circleci/config.yml` (too long to embed wholesale). Workflow shape:

1. **Test/lint jobs run on every push** (any branch or tag): backend test job(s), `jasmine`
   (frontend tests), `checks`/`frontend-checks` (lint), `proxy_extension_tests` (PHPUnit),
   `coverage-final` (finalizes Codacy report).
2. **Base image release jobs** (`release-image`, parameterized by image/arch) build+push each
   `-base` image (amd64 + arm64), gated to tag builds with actual changes since the last tag.
3. **Release chain — tag-only** (semver tag regex `\d+\.\d+\.\d+`, no branches):
   `build-and-release` (triggers the backend PaaS deploy) → upload jobs (proxy files, proxy
   config, extension, frontend `dist/`) → `release` (atomic swap on the SSH host) →
   `warm-up-cache` / `wake-navi` (post-release Navi cache warm, see §12).

Reusable verbatim — `jasmine` job:

```yaml
jasmine:
  docker:
    - image: darthjee/circleci_node:0.2.1
  steps:
    - checkout
    - run:
        name: Set folder
        command: rm backend -rf; cp frontend/* ./ -r; rm frontend -rf
    - run:
        name: Yarn install
        command: yarn install
    - run:
        name: Tests
        command: npm run coverage
    - run:
        name: Upload coverage to Codacy (partial)
        command: bash <(curl -Ls https://coverage.codacy.com/get.sh) report --partial -r coverage/lcov.info
```

Reusable verbatim — `frontend-checks` job:

```yaml
frontend-checks:
  docker:
    - image: darthjee/circleci_node:0.2.1
  steps:
    - checkout
    - run:
        name: Set folder
        command: rm backend -rf; cp frontend/* ./ -r; rm frontend -rf
    - run:
        name: Yarn install
        command: yarn install
    - run:
        name: Check translations
        command: npm run check_i18n   # drop this step if Kerghan skips i18n, see §16
    - run:
        name: Check JS Lint
        command: npm run lint
```

Decided (§21): replace Majora's Python-specific jobs with a Node/Jasmine equivalent, closely
mirroring the frontend's own `jasmine`/`frontend-checks` jobs above (and Navi's own CI job for
`source/`) rather than inventing a new shape:

```yaml
# Majora's pytest_* / checks jobs (Poetry + ruff) — replaced with:
#   - yarn install against a darthjee/circleci_kerghan-base image
#   - yarn coverage (Jasmine + c8), with a cimg/mysql:8.0 service container for
#     Sequelize-touching specs (same DB-service-container pattern as Majora's pytest jobs)
#   - yarn lint (ESLint, §20's flat config) for lint/complexity checks
```

CI setup pattern to keep for both backend and frontend jobs: copy the relevant subdirectory to
the workspace root before running commands, since the CI image expects files at root level (see
the `Set folder` step above — `rm backend -rf; cp frontend/* ./ -r; rm frontend -rf` and its
mirror for backend).

The tag-gated release/upload/`release`/cache-warm jobs (`build-and-release`,
`upload_proxy_files`, `upload_fe_files`, `release`, `warm-up-cache`, `wake-navi`) are entirely
backend-language-agnostic and reusable as-is — see §13 for what each does.

---

## 9. Makefile

Full content of `majora-2/Makefile` (already parameterized by `PROJECT`, so Kerghan can reuse
it near-verbatim by setting `PROJECT?=kerghan`):

```makefile
.PHONY: build-base push-base build push build-fe-base push-fe-base build-fe push-fe build-circleci-base push-circleci-base build-production-base push-production-base dev dev-up setup tests

PROJECT?=kerghan
IMAGE?=$(PROJECT)
BASE_VERSION?=0.1.0
FE_IMAGE?=$(DOCKER_ID_USER)/vite_$(PROJECT)
PUSH_IMAGE=$(DOCKER_ID_USER)/$(PROJECT)
DOCKER_FILE=dockerfiles/$(PROJECT)/Dockerfile
DOCKER_FILE_FE=dockerfiles/vite_$(PROJECT)/Dockerfile

# ── Base images ────────────────────────────────────────────────────────────────

build-base:
	bin/image.sh build $(PROJECT)-base

push-base:
	bin/image.sh push $(PROJECT)-base

build-circleci-base:
	bin/image.sh build circleci_$(PROJECT)-base

push-circleci-base:
	bin/image.sh push circleci_$(PROJECT)-base

build-production-base:
	bin/image.sh build production_$(PROJECT)-base

push-production-base:
	bin/image.sh push production_$(PROJECT)-base

build-fe-base:
	bin/image.sh build vite_$(PROJECT)-base

push-fe-base:
	bin/image.sh push vite_$(PROJECT)-base

# ── Backend ──────────────────────────────────────────────────────────────────

build:
	docker build -f $(DOCKER_FILE) . -t $(IMAGE) -t $(PUSH_IMAGE) -t $(PUSH_IMAGE):$(BASE_VERSION)

push:
	make build
	docker push $(PUSH_IMAGE)
	docker push $(PUSH_IMAGE):$(BASE_VERSION)

# ── Frontend ─────────────────────────────────────────────────────────────────

build-fe:
	docker build -f $(DOCKER_FILE_FE) . -t $(FE_IMAGE) -t $(FE_IMAGE):$(BASE_VERSION)

push-fe:
	make build-fe
	docker push $(FE_IMAGE)
	docker push $(FE_IMAGE):$(BASE_VERSION)

# ── Development ───────────────────────────────────────────────────────────────

setup: .env
	docker-compose run --rm $(PROJECT)_app yarn sequelize-cli db:migrate   # decided (§21): Sequelize CLI, Yarn

dev:
	docker-compose run $(PROJECT)_app /bin/bash

dev-up:
	docker-compose up $(PROJECT)_proxy $(PROJECT)_app $(PROJECT)_fe

tests:
	docker-compose run $(PROJECT)_tests /bin/bash

# ── Environment files ─────────────────────────────────────────────────────────

.env:
	cp .env.dev.sample .env

.env.production:
	touch .env.production
```

Note: `DOCKER_ID_USER` (Docker Hub username) is expected as a host environment variable, not
defined in `.env`.

---

## 10. Environment variables

Full reference: `majora-2/.env.dev.sample`. Grouped for Kerghan (rename `MAJORA_*` →
`KERGHAN_*`):

| Group | Vars (Majora → adapt) | Notes |
|---|---|---|
| Backend framework | `KERGHAN_SECRET_KEY` (session/cookie signing), `KERGHAN_ALLOWED_ORIGINS` (CORS), `NODE_ENV`/`DEBUG` | Decided (§21): simple env-driven config, no framework-specific config system — read once at boot, matching Navi's DI-only convention (§20) |
| Database | `KERGHAN_MYSQL_HOST`, `KERGHAN_MYSQL_PORT`, `KERGHAN_MYSQL_USER`, `KERGHAN_MYSQL_PASSWORD`, `KERGHAN_MYSQL_NAME` | `KERGHAN_MYSQL_PORT` is also referenced directly in `docker-compose.yml`'s host port mapping |
| Email (if needed) | `EMAILS_ENABLED`, email host/port/user/password/TLS/from-address | Only if Kerghan sends email (e.g. digest notifications) |
| Frontend/proxy coupling | `FRONTEND_DEV_MODE`, `FRONTEND_BASE_URL` | `FRONTEND_DEV_MODE` is read directly by the PHP proxy config (§7) — keep the name |
| Cache warmer (Navi) | `KERGHAN_PRODUCTION_URL`, `NAVI_NAMEPACE` | Consumed by the `kerghan_navi` compose service and CI's `warm-up-cache`/`wake-navi` jobs |
| GitHub integration | *(none)* | Decided (§1, §21): Kerghan reads public GitHub data unauthenticated — no client ID/secret/PAT/token var needed for now. Revisit only if private-repo access is added later. |
| Deploy/CI tooling (not in `.env`, set as CircleCI project vars) | `DOCKER_ID_USER`, `RENDER_API_KEY`, `RENDER_SERVICE_NAME`, `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_REMOTE_DIR`, `SSH_REMOTE_TEMP_DIR`, `NAVI_URL`, `NAVI_API_TOKEN`, `KERGHAN_NAMESPACE` | Same secrets Majora needs, under CircleCI's Project Settings → Environment Variables |

---

## 11. `docker_volumes/`

Bind-mount targets for local dev, gitignored contents:

| Subfolder | Purpose | Mounted into |
|---|---|---|
| `mysql_data/` | MySQL data persistence | `kerghan_mysql:/var/lib/mysql` |
| `node_modules/` | Frontend deps cache (keeps container `node_modules` off the host bind mount) | `kerghan_fe:/home/node/app/node_modules` |
| `static/` | Frontend build output (Vite `outDir`), read by the proxy for static serving | `kerghan_fe:/home/node/app/dist` and `kerghan_proxy:/var/www/html/static/` |
| `proxy_cache/` | Tent's HTTP response cache | `kerghan_proxy:/var/www/html/cache/` |

Majora also has `photos/`/`files/` volumes for user-uploaded content — Kerghan likely doesn't
need these unless it stores issue attachments locally; add them back (and the matching proxy
static-serving rules) only if that becomes a requirement.

---

## 12. Navi cache warmer

[Navi](https://github.com/darthjee/navi) is a queue-based cache-warmer (Node.js) that reads a
YAML config describing HTTP resources/clients, and pre-fetches them after a release so the Tent
proxy cache is already warm before real traffic arrives. Full reference:
`majora-2/docs/agents/cache-warmer.md` and `majora-2/docs/agents/external/HOW_TO_USE_NAVI.md`
(hub, links to per-topic pages under `docs/agents/external/navi/`); the richest chaining example
to study is `majora-2/navi/resources/games.yml`.

🚧 TODO: real resource files depend on Kerghan's actual API shape (not decided yet) — and given
Kerghan is multi-tenant, think carefully about whether/how per-user data can be warmed at all
(Navi warms *public, identical-for-everyone* responses; most of Kerghan's dashboard data is
likely user-scoped and simply shouldn't go through Navi — see the "never include restricted
endpoints" rule below).

Entry file skeleton (`navi/navi_config.yaml`):

```yaml
web:
  port: $NAVI_PORT
workers:
  quantity: 5
  retry_cooldown: 10000
  sleep: 500
  max-retries: 50

failure:
  threshold: 0.0

include:
  - resources/clients.yml
  # - resources/issues.yml   # 🚧 TODO once the issues API exists, following the pattern below
```

`navi/resources/clients.yml`:

```yaml
namespace: $NAVI_NAMEPACE
clients:
  default:
    base_url: $KERGHAN_PRODUCTION_URL
    timeout: 20000
```

Template for a future resource file, adapted from Majora's simplest chain
(`navi/resources/treasures.yml`: list → paginated → detail) as a starting shape for e.g. public,
non-user-scoped endpoints only:

```yaml
namespace: $NAVI_NAMEPACE
resources:
  <resource>:
    - url: /<resource>.json
      status: 200
      paginated_actions:
        - resource: paginated_<resource>
          pagination:
            - pages: headers['pages']
            - page_key: page
            - zero_indexed: false
          parameters:
            per_page: headers['per_page']

  paginated_<resource>:
    - url: /<resource>.json?page={:page}&per_page={:per_page}
      status: 200
      actions:
        - resource: <resource>_detail
          parameters:
            id: parsedBody.id

  <resource>_detail:
    - url: /<resource>/{:id}.json
      status: 200
```

Rules for maintaining the config (carried over from Majora's `cache` agent conventions): include
only `GET` endpoints; never include mutation endpoints; never include restricted/access-controlled
endpoints. Given Kerghan's multi-tenant model, expect most endpoints to be excluded from Navi
entirely unless Kerghan later adds genuinely public data (e.g. an unauthenticated public status
page).

Locally, run via the `kerghan_navi` compose service (`docker-compose up kerghan_navi`, web UI at
`http://localhost:3100`). In CI, driven via the `navi-hey-client` CLI against a persistent Navi
server — see §8 and §13, and `scripts/wake_navi.sh`/`scripts/warm_navi_cache.sh` for the exact
invocation pattern (reusable as-is, just repoint `$NAVI_URL`/`$NAVI_API_TOKEN`/namespace to
Kerghan's own Navi deployment).

---

## 13. Deployment flow

Majora deploys to **two targets**, no Kubernetes:

- **Render.com** (PaaS) — hosts the backend app container. Triggered via the Render REST API
  (`scripts/render.sh`, `scripts/deploy.sh`), not a registry push — Render tracks a git
  branch/tag and builds it server-side.
- **A single SSH-reachable host** running the Tent proxy — receives rsync/scp file pushes
  (`bin/deploy_frontend.sh`) for: proxy PHP files, proxy config, the Tent extension, and built
  frontend static assets. This is where the atomic release swap happens.

Script chain (all reusable as-is unless noted):

| Script | Purpose |
|---|---|
| `bin/image.sh` | Build/push/QEMU-setup for Docker Hub images (base + leaf); reads version from the root `version` file (§14); skips pushes on non-tag commits or unchanged `dockerfiles/<image>/` subtrees |
| `bin/deploy_frontend.sh` | SSH/rsync deploy: `build`, `generate_key_file`, `generate_folder`, `copy_files`, `upload` (to a workspace-scoped remote temp dir), `link` (symlink shared dirs), `release` (atomic rename swap into the live path, with a temporary `_old_<timestamp>` backup) |
| `scripts/deploy.sh` | Render deploy driver: `update_deploy_branch` (points Render at the just-pushed tag), `deploy`/`force_deploy` (triggers + polls until `live`), `watch` |
| `scripts/render.sh` | Thin Render REST API client (curl+jq), authenticated with `$RENDER_API_KEY` |
| `scripts/bump_version.sh` | Bumps semver across `README.md`, `frontend/package.json`, and `backend/package.json` (was `backend/pyproject.toml`) |
| `scripts/wake_navi.sh` | Polls `$NAVI_URL` until it stops responding `502`, to wake a possibly-sleeping Navi server before `warm-up-cache` needs it |
| `scripts/warm_navi_cache.sh` | `config` (pushes `navi/resources/*.yml` via `navi-client`) then `engine-start` (triggers the warm-up run for the build's namespace) |

The release order matters: base images build/push → app deploy (Render) → proxy/static file
upload → **atomic swap** (`release`) → cache warm-up (`warm-up-cache`, strictly *after* the
swap). See §8 for the CI job graph that drives this.

---

## 14. `version` file & base image versioning

Root `version` file — a flat registry of base-image versions, decoupled from the app's own
release version (which lives in `README.md`, `frontend/package.json`, and the backend manifest,
bumped by `scripts/bump_version.sh`):

```
kerghan-base=0.1.0
circleci_kerghan-base=0.1.0
production_kerghan-base=0.1.0
vite_kerghan-base=0.1.0
```

Read by `bin/image.sh`'s `image_version()` to tag pushed images `:latest`, `:cached`, and
`:<version>`.

---

## 15. Frontend build & test tooling

Fully reusable as-is — the React/Vite side is identical regardless of backend language.

`vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 8080,
    host: '0.0.0.0',
    strictPort: false,
    cors: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
});
```

No `build.outDir` override (defaults to `dist/`, matching the `docker_volumes/static` mount).
No Vite `server.proxy` to the backend — that's the Tent proxy's job (§7), not Vite's.

Key `package.json` scripts (see `majora-2/frontend/package.json` for the full dependency list):

```json
{
  "scripts": {
    "build": "vite build",
    "server": "vite dev --host 0.0.0.0 --port 8080",
    "test": "NODE_OPTIONS='--loader ./specs/support/jsx-loader.mjs' nyc npx jasmine \"specs/**/*[sS]pec.js\"",
    "coverage": "NODE_OPTIONS='--loader ./specs/support/jsx-loader.mjs' npx c8 --reporter=lcov jasmine \"specs/**/*[sS]pec.js\"",
    "lint": "eslint assets specs",
    "lint_fix": "eslint assets specs --fix",
    "check_i18n": "node scripts/check_i18n.js"
  }
}
```

ESLint config (`eslint.config.mjs`, flat config), key rules: 2-space indent, single quotes,
required semicolons, `eqeqeq`, `no-var`/`prefer-const`, max complexity 10, max file length 300
lines, JSDoc required on public classes/methods/functions (`@param`, `@returns`,
`@description`, all with descriptions). Full file: `majora-2/frontend/eslint.config.mjs`.

Tests use plain **Jasmine** (not Karma/browser) + **c8**/**nyc** for coverage, driven through a
custom Node ESM loader (`specs/support/jsx-loader.mjs`) that transforms `.jsx` via Babel, stubs
image/CSS imports, handles Vite's `?raw` suffix, and shims `import.meta.env`. Spec files mirror
the source tree 1:1 under `frontend/specs/`. Reuse this whole setup, including
`specs/support/factories.js`, `fetchMock.js`, `controllerStubs.js` as test-helper patterns.

Frontend Dockerfiles: see §6.

---

## 16. i18n (optional)

Majora ships a lightweight, hand-rolled i18n layer (`frontend/assets/js/i18n/Translator.js` +
YAML files under `frontend/assets/i18n/`, dot-path lookups, a header language selector,
`localStorage` persistence). Full reference: `majora-2/docs/agents/i18n.md`.

Include this only if Kerghan needs a multi-language UI. If skipped, drop the `check_i18n` step
from the `frontend-checks` CI job (§8) and the `scripts/check_i18n.js` script.

---

## 17. Code style & `.codacy.yml`

Frontend style (ESLint-enforced, no Prettier/`.editorconfig` in Majora — ESLint's
`indent`/`quotes`/`semi` rules serve that role): 2-space indentation, single quotes, semicolons
required, Unix line endings, strict equality, `const` by default, max complexity 10, max 300
lines/file, JSDoc required on public API. English-only for all documentation and code comments
(project-wide convention, not just frontend).

Decided (§21): backend lint/style is ESLint using Navi's own flat config (§20) — 2-space indent,
single quotes, semicolons required, `===`, max complexity 10, max 300 lines/file, JSDoc required
— rather than a separate Node-specific rule set. Same style as the frontend, just enforced by a
backend-scoped ESLint run (`backend/eslint.config.mjs`, `yarn lint`).

`.codacy.yml` (Codacy static-analysis config, coverage uploaded via
`coverage.codacy.com/get.sh` in CI jobs — needs a `CODACY_PROJECT_TOKEN`-equivalent CircleCI
secret):

```yaml
engines:
  duplication:
    exclude_paths:
      - "frontend/specs/**"
      - "backend/spec/**"   # Jasmine convention (§20/§21), matching Navi's own spec/ layout
  # bandit engine was Python-specific (majora's Django backend) — replace with a
  # Node-appropriate security engine (e.g. an ESLint-security-plugin-based Codacy engine)
  phpmd:
    exclude_paths:
      - "proxy/extension/tests/**"
  phpcs:
    exclude_paths:
      - "proxy/extension/tests/**"
```

---

## 18. Agent documentation scaffolding (`.claude/agents/` + `docs/agents/`)

Majora uses two coordinated layers of AI-facing documentation, worth replicating for Kerghan
from day one:

- **`docs/agents/`** — a **hub-doc pattern**: `index.md` is a link-only table of contents;
  `summary.md` gives a 2-4 line abstract of every doc so an agent can decide whether to open the
  full file; topic docs (`architecture.md`, `folder-structure.md`, `contributing.md`, etc.)
  themselves link out to focused sub-pages (e.g. `architecture/proxy.md`,
  `architecture/frontend.md`) to keep any single doc small enough to load without excess
  context. See `majora-2/docs/agents/index.md` and `majora-2/docs/agents/summary.md` for the
  exact shape to mirror.
- **`.claude/agents/*.md`** — one specialist AI agent per concern, each with a frontmatter
  `name`/`description`/`tools` block and a scoped set of responsibilities ("your scope is X, do
  NOT touch Y, delegate Z to the `w` agent"), so tasks route to the right specialist.

Agent roster to create for Kerghan, based on Majora's (`majora-2/.claude/agents/`):

| Agent | Reusable? |
|---|---|
| `architect` | Yes — cross-cutting coordinator, mostly project-name substitution |
| `infra` | Yes — backend-agnostic (docker-compose, Dockerfiles, CI, deploy scripts, Makefile) |
| `frontend` | Yes — fully reusable (React/Vite/Jasmine/ESLint scope is identical) |
| `proxy` | Yes — Tent is backend-agnostic; `backend.php`'s `*.json` matcher is decided (§7) and needs no change |
| `cache` | Yes, once API endpoints exist — owns `navi/` config (§12) |
| `security` | Adapt — reuse the checklist structure; Kerghan's current surface has no GitHub-token/credential storage to review (§1 — unauthenticated, public data only for now), so focus on the multi-tenant account/session surface instead |
| `data-access` | Adapt — reuse the read-only reviewer role, rewrite against Kerghan's actual access-control doc once written |
| `product-owner` | Adapt — reuse the role, point at Kerghan's own `docs/agents/product.md` once written |
| `backend` | 🚧 TODO to write, but unblocked — stack decided (§20/§21: Express, Sequelize, Jasmine), template: §20's "Agent template" |

`infra.md` (adapted template, ready to use — rename services/images per §5–§9):

```markdown
---
name: infra
description: Kerghan infrastructure specialist. Use for any task involving docker-compose, Dockerfiles, CircleCI pipeline, deployment scripts, Makefile, or production configuration. Delegate PHP proxy tasks to the proxy agent and Navi cache warmer tasks to the cache agent.
tools: Read, Edit, Write, Bash
---

You are the infrastructure specialist for the Kerghan project — a GitHub issue monitoring and
dashboard app.

## Your scope

- `docker-compose.yml` — full stack service definitions
- `dockerfiles/` — all service images (backend, frontend, production, CI variants)
- `.circleci/config.yml` — CI/CD pipeline
- `scripts/` — deployment and release scripts
- `Makefile` — development command interface
- Production configuration files (when added to the repository)

Do NOT touch `backend/` (backend), `frontend/` (frontend code), or `proxy/` (PHP proxy
source — delegate those tasks to the `proxy` agent).

**Never install packages or invoke tooling directly on the host machine.** Always run commands
through `docker-compose run` or the relevant image.

## Services (docker-compose.yml)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `kerghan_app` | `darthjee/kerghan` | 3030 | Backend dev server |
| `kerghan_tests` | `darthjee/kerghan` | — | Backend test runner |
| `kerghan_fe` | built from `dockerfiles/vite_kerghan/` | 3010 | Vite dev server / build |
| `kerghan_proxy` | `darthjee/tent:0.10.1` | 3000 | Reverse proxy (single entry point) |
| `kerghan_mysql` | `mysql:9.3.0` | configurable | Database |
| `kerghan_navi` | `darthjee/navi-hey:1.5.1` | 3100 | Cache warmer (local) |
| `kerghan_phpmyadmin` | `phpmyadmin/phpmyadmin` | 3050 | DB admin UI |

(See kerghan.md §5–§14 in the source infra doc for the full rationale behind every job/script.)
```

`proxy.md` and `frontend.md` — reuse `majora-2/.claude/agents/proxy.md` and
`majora-2/.claude/agents/frontend.md` near-verbatim (just `majora`→`kerghan` renames); their
content is entirely backend-agnostic.

`docs/agents/folder-structure.md` should mirror §4 of this document as a Markdown table;
`docs/agents/architecture.md` should be a thin hub page linking to `architecture/proxy.md`,
`architecture/frontend.md`, and (once written) `architecture/backend.md`, following the pattern
in `majora-2/docs/agents/architecture.md`.

---

## 19. `.github/` templates

Reusable verbatim.

`.github/copilot-instructions.md`:

```markdown
See [AGENTS.md](../AGENTS.md) for project instructions.
```

`.github/commit_message_template.md`:

```
<type>(<scope>): <subject> (issue #<id>)

<optional body: what was done and why, if not obvious>

Co-Authored-By: <AI model name> <AI model email>
Co-Authored-By: <agent> agent <AI model email>
```

`.github/pull_request_template.md`:

```markdown
## Summary

<!-- One sentence describing what this PR does -->

## Problem

<!-- What problem does this solve? Why is this change needed? -->

## Solution

<!-- How was the problem solved? What approach was taken? -->

## Details

<!-- Optional: implementation notes, migration steps, caveats. Remove this section if not needed. -->

## Environment Variables & Settings

<!-- List any new or changed environment variables / settings this PR introduces. Write "None" if not applicable. -->

Fixes #
```

---

## 20. Backend reference — Navi's Node.js stack

Majora has no Node backend to mirror (its backend is Python/Django), so §6/§20 above could only
sketch the *shape* of a Node Dockerfile, not a working one. This repository — **Navi**
(`darthjee/navi`, a queue-based cache-warmer, Node.js/Express, checked out locally at `navi/`
alongside `majora-2/`) — is a real, opinionated Node backend the user likes and wants mirrored for
Kerghan's style/tooling/agent conventions. **Assumes the reading AI also has filesystem access to
this `navi` checkout**, the same way §0 assumes `majora-2` access; references below follow the
same `See navi/<path>` convention.

Caveat: Navi has **no database** — it's a stateless YAML-config-driven job queue, not a CRUD app —
so nothing here answers the ORM/migration/GitHub-auth questions still open in §21. What it does
offer is a proven Node project skeleton: dependency choices, a 3-stage Dockerfile, ESLint style,
an Express routing/error-handling pattern, and a `.claude/agents/` specialist template — all
worth reusing as a starting point rather than reinvented from scratch.

### Packages

`navi/source/package.json` — the main app. Deliberately small: one web framework, no
kitchen-sink meta-framework.

```json
"dependencies": {
  "axios": "^1.13.0",
  "express": "5.2.1",
  "node-html-parser": "7.1.0",
  "yaml": "^2.8.2"
},
"devDependencies": {
  "@eslint/js": "^8.0.0",
  "c8": "11.0.0",
  "eslint": "^8.0.1",
  "eslint-config-standard": "^17.0.0",
  "eslint-plugin-complexity": "^1.0.2",
  "eslint-plugin-import": "^2.26.0",
  "eslint-plugin-jasmine": "^4.1.3",
  "eslint-plugin-jsdoc": "^62.7.1",
  "eslint-plugin-n": "^15.3.0",
  "eslint-plugin-promise": "^6.0.1",
  "eslint-plugin-sort-class-members": "1.22.1",
  "globals": "^16.5.0",
  "jasmine": "^5.0.0",
  "jscpd": "4.0.8",
  "jsdoc": "4.0.5"
}
```

`navi/dev/app/package.json` is arguably the closer precedent for Kerghan's starting point: a
minimal Express JSON API with no framework opinions beyond routing —
`express`, `js-yaml`, `morgan` (request logging) as runtime deps, the same
Jasmine/c8/ESLint/JSCPD dev toolchain. Kerghan's own `backend/package.json` will need to add
whatever MySQL driver/ORM gets chosen in §21 on top of this base — that choice isn't answered
here.

Recommendation for the backend AI: don't default to a heavy framework (NestJS) just because it's
"more like Django" — Kerghan's API surface (aggregation-friendly JSON endpoints + a polling
worker, per §1) is closer in shape to Navi's own Express app than to a full MVC framework.
Express (or Fastify, if schema-validated request/response bodies are wanted up front) plus a thin
in-house routing layer, mirrored on `navi/source/lib/server/` (below), covers it without adding a
DI-container learning curve.

### Docker image — note: **not published**

Per project decision, Kerghan's backend image (`kerghan`/`kerghan-base`) will **not** be pushed to
Docker Hub, unlike Majora's `darthjee/majora` and unlike Navi's own `darthjee/navi-hey`. This
doesn't change the Dockerfile *shape* — still build/push the 3-stage `base` →
`builder`(dep-cache) → final pattern from §6 for local dev/CI image reuse — it only means: drop
the `push`/`push-base` Makefile targets and the CI `release-image` job (§8) for this specific
image; build it locally via `docker-compose build`/`make build` only. This is consistent with
§13's deploy story anyway — Render builds the backend server-side from the pushed git tag, it
never pulls a prebuilt Docker Hub image, so skipping the backend image push loses nothing in the
deploy path. (Frontend/proxy base images may still need publishing if reused elsewhere — that's
unaffected by this decision.)

Reference dev Dockerfile, `navi/dockerfiles/dev_app/Dockerfile` — same base/builder/final shape
as majora's backend Dockerfile in §6, just with a Node base image and `yarn_builder.sh` instead of
`poetry_builder.sh`:

```dockerfile
FROM darthjee/scripts:0.6.0 as scripts
FROM darthjee/node:0.2.1 as base

USER root
RUN apt-get update && apt-get install -y rsync && rm -rf /var/lib/apt/lists/*
USER node

COPY --chown=node:node \
  ./dev/app/package.json ./dev/app/yarn.lock \
  /home/node/app/

######################################

FROM base as builder

ENV HOME_DIR /home/node

USER root
COPY --chown=node:node --from=scripts /home/scripts/builder/yarn_builder.sh /usr/local/sbin/yarn_builder.sh
RUN /bin/bash yarn_builder.sh

#######################
# FINAL IMAGE
FROM base
ENV HOME_DIR /home/node

COPY --chown=node:node --from=builder /home/node/yarn/new/ /usr/local/share/.cache/yarn/v6/

USER node
```

**Do not** mirror `navi/dockerfiles/production_navi_hey/Dockerfile` verbatim — it installs Navi
from the published `navi-hey` npm package (`npm install -g navi-hey@${NAVI_VERSION}`), which only
works because Navi *is* a published package. Kerghan's backend isn't published anywhere, so its
production image needs to `COPY` the built `backend/` source into the final stage instead (closer
to majora's own production Dockerfile pattern — check `majora-2/dockerfiles/production_majora/Dockerfile`
for that shape).

### Code style

`navi/source/eslint.config.mjs` (flat config) is a ready-to-adapt backend ESLint config — stricter
than what §17 could specify for the (still-undecided) backend language. Key rules, from
`navi/docs/agents/architecture/style-and-tooling.md` and `navi/AGENTS.md`:

- ES Modules only (`"type": "module"`, `import`/`export`, `.js` extensions required on every
  import path) — no CommonJS.
- Yarn, never `npm install`.
- 2-space indent, single quotes (double only to avoid escaping), semicolons required, `===`
  always, `const` by default/`let` when reassigned, `var` forbidden.
- `no-unused-vars` (params prefixed `_` exempted); `console` limited to `.warn`/`.error`.
- Import order enforced: alphabetized, grouped `builtin → external → internal → local`
  (`eslint-plugin-import`'s `import/order`).
- Complexity caps: max cyclomatic complexity 10, max file length 300 lines, max nesting depth 4.
- `eslint-plugin-sort-class-members`: static properties → static methods → properties →
  constructor → public methods → private (`#`-prefixed) methods.
- JSDoc required on public methods/classes (`eslint-plugin-jsdoc`), checked via `yarn docs` /
  `yarn check_docs` (JSDoc's `--pedantic` flag).
- Duplication tracked via JSCPD (`yarn report`), same tool §17's `.codacy.yml` config would want
  wired in for the backend once the language/linter is chosen.

This is a strict superset of what majora's backend (ruff, 100-char lines) enforces — worth
adopting as-is for Kerghan rather than inventing a separate backend style guide.

### Express architecture pattern

`navi/source/lib/server/` (full writeup: `navi/docs/agents/web-server.md`) is a reusable shape for
structuring any Express JSON API, independent of the cache-warmer domain logic:

```
server/
├── WebServer.js               # boots Express, mounts the router
├── Router.js                  # declarative path → HandlerConfig map
├── RouteRegister.js           # wraps handlers; maps domain exceptions to HTTP status codes
├── PathValidator.js           # path-traversal protection for static/asset routes
├── SecuredRequestHandler.js   # base class for token-secured routes (e.g. an /api/* namespace)
└── handlers/                  # one class per route, `handle(req, res)`
```

`RouteRegister` is the piece most worth copying directly — it centralizes exception→status-code
mapping instead of scattering `try/catch` per handler, and logs every request uniformly:

```js
// navi/source/lib/server/RouteRegister.js (excerpt)
register({ route, handler }) {
  this.#router.get(route, (req, res) => {
    try {
      handler.handle(req, res);
      Logger.debug(`${req.method} ${req.path} ${res.statusCode}`);
    } catch (e) {
      this.#handleError(e, req, res);   // ForbiddenError→403, NotFoundError→404, else 500
    }
  });
}
```

Paired with `navi/source/lib/exceptions/AppError.js` — a one-class exception base every custom
error extends, auto-naming itself from the subclass:

```js
class AppError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

...and `navi/source/lib/serializers/` (plain-object view classes turning models into JSON
responses, e.g. `JobIndexSerializer` vs. `JobShowSerializer` — a lean list-view/detail-view
split). Given §1's "aggregation-friendly, not just CRUD" requirement, a serializer class per view
shape (e.g. `IssueListSerializer`, `IssueDetailSerializer`, `AttentionSummarySerializer`) is a
direct fit.

### Agent template

`navi/.claude/agents/engine.md` is the closest existing analog to the `backend` agent §18 leaves
as 🚧 TODO — adapt its shape (scope list, stack, commands, conventions) rather than starting from
majora's Python-flavored `data-access`/`security` agents. Its **Conventions** section is largely
language-idiom, not cache-warmer-specific, and transfers directly:

- Every source file (outside the entrypoint) is a class declarer, never a script.
- Class files use CamelCase matching the class name; specs are `<ClassName>_spec.js`.
- Public methods before private (`#`-prefixed) methods (enforced by `sort-class-members`, above).
- Dependency injection only — classes never load files/env vars themselves (relevant for Kerghan:
  the DB connection/pool should be constructed once and injected, not opened ad hoc per class).
- All custom exceptions extend `AppError` (directly or via an intermediate class).
- Registries extend a common `NamedRegistry` base, overriding only what varies
  (`navi/source/lib/registry/NamedRegistry.js`) — same pattern applies to Kerghan if it ends up
  with multiple named collections-of-things-with-lookup (e.g. a registry of label-rule
  evaluators).

Full file for reference: `navi/.claude/agents/engine.md`.

---

## 21. Backend — decisions and remaining 🚧 TODO (Node specialist)

The foundational backend questions this document originally left open have now been decided, in
conversation, before any scaffolding started. §20 is the concrete precedent (Navi, this repo)
those decisions draw from — consult it for the actual package/style/architecture/agent shape.

### Decided

- **Runtime/framework/package manager** — **Express + plain JavaScript (ES Modules) + Yarn**,
  mirroring Navi's own stack exactly (§20 "Packages"/"Code style"). No TypeScript, no NestJS/
  Fastify — Kerghan's API surface doesn't need that ceremony.
- **DB access layer** — **Sequelize** (model-based ORM + `sequelize-cli` migrations), the closest
  Node equivalent to the Django ORM workflow Majora uses. `make setup` runs
  `yarn sequelize-cli db:migrate` (§9).
- **GitHub auth model** — **none, for now**. Kerghan reads only **public** GitHub REST API data,
  fully **unauthenticated**. No OAuth app, no PAT storage, no GitHub App installation, no related
  `.env` vars (§1, §10). Known constraint to design around: GitHub's unauthenticated rate limit is
  **60 requests/hour per source IP**, shared across every Kerghan user polling from this one
  server — see the polling decision below for how that's handled. Revisit this decision if/when
  private-repo access is ever needed.
- **Scheduled/background polling** — **none for now**. No dedicated `kerghan_worker` compose
  service, no scheduler. Issue data is fetched **on-demand** (when a user views a tracked repo)
  and cached in MySQL between views — this is also what keeps the shared 60/hour budget workable
  at small scale. A planned future addition: letting the **frontend** call GitHub's public API
  directly for some views, which spreads request load across each user's own browser IP instead
  of pooling everything through the server's IP — worth keeping the API/data-fetching layer
  structured so that path is addable later without a rewrite.
- **Proxy `backend.php` matcher convention** — **kept as-is**: Majora's `*.json`-suffix
  convention, no matcher change needed (§7).
- **GitHub webhook ingress** — **not built**. Consistent with the on-demand/pull model above;
  also webhooks need per-repo admin setup, which doesn't fit an unauthenticated,
  arbitrary-public-repo model well anyway (§7).
- **Admin UI** — **none**. `proxy/*/rules/admin.php` is dropped entirely, not adapted (§7).
- **CircleCI backend test/lint job(s)** — **Jasmine + c8** for tests/coverage, **ESLint** for
  lint, mirroring the frontend's own `jasmine`/`frontend-checks` jobs and Navi's own CI job
  shape (§8, §20).
- **`.env` vars for the framework** — **simple env-driven config**: `KERGHAN_SECRET_KEY`
  (session/cookie signing), `KERGHAN_ALLOWED_ORIGINS` (CORS), `NODE_ENV`/`DEBUG` — read once at
  boot, no hidden env reads inside classes (§10, §20's DI-only convention).

### Still open

- **`backend/` Dockerfiles** — the actual files still need writing: base + leaf pair mirroring
  §20's `navi/dockerfiles/dev_app/Dockerfile`, plus production and CircleCI variants. **Not
  published to Docker Hub** for this project (§6, §20) — drop the `push`/`push-base` Makefile
  targets and CI `release-image` job for this image.
- **User account / tracked-repo / label-rule data model** — still the core undecided product
  question (§1): how a Kerghan user's tracked repos/orgs and label rules are modeled and scoped
  per account. This is unrelated to GitHub auth (now resolved) — it's about *Kerghan's own*
  accounts, not GitHub credentials.
- **Documentation** — `docs/agents/architecture/backend.md`, an equivalent of
  `views-organization.md`/`serializers-organization.md`/`models-organization.md` for whatever
  folder convention the Node backend adopts (§20's `navi/source/lib/server/` layout — router,
  route-register, handlers, serializers — is a reasonable default to document against), the
  `backend` entry in `.claude/agents/` (§18, template: §20's "Agent template"), and eventually
  `docs/agents/product.md` capturing the real data model once the item above is resolved.
- **Real Navi `resources/*.yml` files** once API endpoints exist (§12) — remembering that
  Kerghan's own per-account dashboard views are still user-scoped (even though the underlying
  GitHub data is public) and likely shouldn't be cache-warmed at all.
