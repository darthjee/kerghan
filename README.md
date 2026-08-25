# kerghan
A tool for monitoring github issues

[![Build Status](https://circleci.com/gh/darthjee/kerghan.svg?style=shield)](https://circleci.com/gh/darthjee/kerghan)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/fb47154bedbb42799e51d50f51f87054)](https://app.codacy.com/gh/darthjee/kerghan/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/fb47154bedbb42799e51d50f51f87054)](https://app.codacy.com/gh/darthjee/kerghan/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_coverage)

**Current Version:** [0.1.1](https://github.com/darthjee/kerghan/releases/tag/0.1.1)

**Next Release:** [0.1.2](https://github.com/darthjee/kerghan/compare/0.1.1...main)

## About

Kerghan is a GitHub issue monitoring/dashboard app. Users log in (a lightweight Kerghan account,
not GitHub OAuth) and choose which repos/orgs to monitor — that selection is the only thing the
backend persists. Issue data itself is fetched live, on demand, by the frontend calling GitHub's
public API directly, so the backend stays idle between visits. The driving use case is
label-based attention triage — surfacing which of a user's many tracked repos "need my
attention" in one place. See [docs/agents/flow.md](docs/agents/flow.md) for the full flow.

The application is structured as a Node/Express backend and a React single-page application
frontend, served together through the [Tent](https://github.com/darthjee/tent) reverse proxy —
the same shape as [Majora](https://github.com/darthjee/majora), the project this one's
infrastructure was bootstrapped from.

**Status:** early infrastructure bootstrap. There are no real models, routes, or components yet
— the backend is an Express/Sequelize skeleton with a single health-check route, and the
frontend is a Vite/React tooling skeleton with a placeholder shell. See `docs/agents/product.md`
for what's decided vs. still open about the actual data model.

## Technology Stack

**Backend**
- **Node.js / Express** — Application framework
- **Sequelize** — ORM + migrations
- **MySQL 8** — Relational database
- **Yarn** — Package manager
- **Jasmine + c8** — Test suite
- **ESLint** — Linting

**Frontend**
- **React 19** — UI framework
- **Vite** — Build tool and dev server
- **Jasmine + c8** — Tests and coverage
- **ESLint** — Linting
- **Yarn** — Package manager

**Infrastructure**
- **Docker & Docker Compose** — Containerisation and orchestration
- **[darthjee/tent](https://github.com/darthjee/tent)** — Reverse proxy (port 3000)
- **[darthjee/navi](https://github.com/darthjee/navi)** — Cache warmer

## Project Structure

```
kerghan/
├── backend/              # Node/Express backend, no models yet
├── frontend/             # React + Vite frontend, tooling skeleton
├── proxy/                # PHP proxy (darthjee/tent) configuration and extensions
├── dockerfiles/          # Dockerfiles for each service
├── docker_volumes/       # Bind-mounted volumes (static assets, proxy cache)
├── navi/                 # Navi cache-warmer configuration
├── docs/                 # Project documentation
└── docker-compose.yml    # Full stack service definitions
```

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
- **Full stack (proxy):** http://localhost:3000
- **Backend API:** http://localhost:3030
- **Frontend dev server:** http://localhost:3010

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
