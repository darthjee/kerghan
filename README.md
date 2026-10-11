# kerghan

A tool for monitoring github issues

[![Build Status](https://circleci.com/gh/darthjee/kerghan.svg?style=shield)](https://circleci.com/gh/darthjee/kerghan)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/fb47154bedbb42799e51d50f51f87054)](https://app.codacy.com/gh/darthjee/kerghan/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/fb47154bedbb42799e51d50f51f87054)](https://app.codacy.com/gh/darthjee/kerghan/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_coverage)

**Current Version:** [0.6.1](https://github.com/darthjee/kerghan/releases/tag/0.6.1)

**Next Release:** [0.6.2](https://github.com/darthjee/kerghan/compare/0.6.1...main)

## About

Kerghan is a GitHub issue monitoring/dashboard app. Users log in (a lightweight Kerghan account,
not GitHub OAuth) and choose which repos/orgs to monitor — that selection is the only thing the
backend persists. Issue data itself is fetched live, on demand, by the frontend calling GitHub's
public API directly, so the backend stays idle between visits. The driving use case is
label-based attention triage — surfacing which of a user's many tracked repos "need my
attention" in one place. See [docs/agents/flow.md](docs/agents/flow.md) for the full flow.

The application is structured as a NestJS backend and a React single-page application
frontend, served together through the [Tent](https://github.com/darthjee/tent) reverse proxy —
the same shape as [Majora](https://github.com/darthjee/majora), the project this one's
infrastructure was bootstrapped from.

**Status:** the tracked-repo/label-rule data model — the core dashboard/analytics feature — is
still not built. What does exist: a NestJS/TypeORM backend with a real Auth module
(username/password login, JWT cookie + rotating refresh token, and a device-authorization flow),
and a React frontend with a login/register/device-authorization modal, hash-based routing, and a
full HTTP client layer. See `docs/agents/product.md` for what's decided vs. still open about the
tracked-repo/label-rule data model.

## Technology Stack

### Backend

- **Node.js / NestJS** — Application framework
- **TypeORM** — ORM + migrations
- **MySQL 8** — Relational database
- **Yarn** — Package manager
- **Jest + `@swc/jest` + `supertest` + `@nestjs/testing`** — Test suite
- **ESLint** — Linting

### Frontend

- **React 19** — UI framework
- **Vite** — Build tool and dev server
- **Jasmine + c8** — Tests and coverage
- **ESLint** — Linting
- **Yarn** — Package manager

### Infrastructure

- **Docker & Docker Compose** — Containerisation and orchestration
- **[darthjee/tent](https://github.com/darthjee/tent)** — Reverse proxy (port 3000)
- **[darthjee/navi](https://github.com/darthjee/navi)** — Cache warmer

## Project Structure

```
kerghan/
├── backend/              # NestJS/TypeORM backend — Auth module, tracked-repo model still open
├── frontend/             # React + Vite frontend — login modal + auth flow, dashboard views still to come
├── proxy/                # PHP proxy (darthjee/tent) configuration and extensions
├── dockerfiles/          # Dockerfiles for each service
├── docker_volumes/       # Bind-mounted volumes (static assets, proxy cache)
├── navi/                 # Navi cache-warmer configuration
├── standalone/           # Standalone distribution: inner stack, kerghan client, installer
├── docs/                 # Project documentation
└── docker-compose.yml    # Full stack service definitions
```

## Run Kerghan standalone

Kerghan also ships as one container that runs the whole stack (MySQL, the backend and the
frontend), for self-hosting and local use. The `kerghan` client starts and manages it.

**Requirements:** Linux or macOS, and Docker with the [Sysbox](https://github.com/nestybox/sysbox)
runtime or `--privileged` containers allowed.

### Install

```bash
curl -fsSL https://github.com/darthjee/kerghan/releases/latest/download/install.sh | bash
```

This installs the `kerghan` client into `~/.local/bin` (set `KERGHAN_INSTALL_DIR` to change it,
`KERGHAN_VERSION` to pick a release), and the `vault` CLI it relies on when it is missing. It
never uses `sudo`. To verify the downloads against the release's `SHA256SUMS`, see
[docs/agents/standalone.md](docs/agents/standalone.md#verifying-the-release-assets).

### Run

```bash
kerghan up              # starts Kerghan on http://localhost:3000
kerghan up -p 8080      # on another port
kerghan up --offline    # with the offline image
```

The other commands are `kerghan down` (stop; data is kept), `kerghan logs [-f]`,
`kerghan status`, `kerghan compose <args>` and `kerghan reset` (wipe all data, after a
confirmation). Run `kerghan help` for the full list.

### Upgrade

Run the installer again, then `kerghan up`: the instance is recreated with the new image, the
data is kept, and the database migrations run on boot. Downgrades are not supported.

### Online and offline images

- `darthjee/kerghan-standalone:<version>` (online) pulls its inner images on the first start.
- `darthjee/kerghan-standalone:<version>-offline` ships them preloaded: use it on hosts without
  access to Docker Hub. It is larger and starts more slowly.

The client picks the image for you. If you run the image with plain `docker run` instead, you
must pass `--privileged` (or the Sysbox runtime), the required secrets (`KERGHAN_SECRET_KEY`,
`KERGHAN_INTEGRATIONS_KEY`) and `FRONTEND_BASE_URL` yourself.

### Configuration (`~/.kerghan/`)

| File | Content |
|---|---|
| `~/.kerghan/config` | Optional client settings: `port`, `variant`, `runtime`, `stop-timeout`, `image-tag`. Copy `config.example` from the release assets to start. |
| `~/.kerghan/kerghan.env` | Secrets generated on the first `kerghan up`, plus any backend variables you add (see [Standalone variables](docs/agents/environment-variables.md#5-standalone-darthjeekerghan-standalone)). |

### Caveats

See [Caveats](docs/agents/standalone.md#caveats) for the details of each one.

- **HTTPS:** plain HTTP works only on `localhost`. Anywhere else, put a TLS reverse proxy in
  front, otherwise login fails.
- **Back up `~/.kerghan/kerghan.env`:** losing it logs everyone out and makes stored integration
  credentials unreadable.
- **MySQL password:** fixed when the data volume is created.
- **Disk usage:** older inner images pile up after upgrades; prune them by hand.
- **No downgrades**, and **one instance per host**.
- **Demo user:** standalone databases contain the `demo` user.

See [docs/agents/standalone.md](docs/agents/standalone.md) for the full reference.

## Development Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed

### First Time Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/darthjee/kerghan.git
   cd kerghan
   ```

2. Create the `.env` file and run database migrations:
   ```bash
   make setup
   ```

3. Review and adjust `.env` values if needed.

### Running the Application

```bash
# Start the full stack (proxy + backend + frontend dev server)
make dev-up
```

The application will be available at:

- **Full stack (proxy):** <http://localhost:3000>
- **Backend API:** <http://localhost:3030>
- **Frontend dev server:** <http://localhost:3010>

### Development Shells

```bash
# Open a backend shell
make dev

# Open a test shell
make tests
```

### Running Tests

Inside the backend shell (`make dev`) or test shell (`make tests`):
```bash
yarn test        # run Jasmine specs
yarn coverage    # generate coverage with c8
yarn lint        # lint source and specs
```

Frontend tests (from `frontend/`, or via `docker-compose run kerghan_fe`):
```bash
yarn test        # run Jasmine specs
yarn coverage    # generate coverage with c8
yarn lint        # lint source and specs
```

## Documentation

Agent-facing documentation lives under [`docs/agents/`](docs/agents/) — start at
[`docs/agents/index.md`](docs/agents/index.md). Project instructions for AI agents live in
[`AGENTS.md`](AGENTS.md).
