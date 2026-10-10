# External Tooling

Kerghan depends on a few external, non-Kerghan-specific tools. Their full usage guides live
under `docs/agents/external/` and are kept out of the rest of `docs/agents/` so that agent
context isn't loaded with reference material for a tool it isn't touching. Read the linked guide
before making changes involving that tool.

- [How to Use Tent](external/how-to-use-tent.md) — the PHP reverse proxy Kerghan runs as its
  single entry point (`proxy/`). Consulted by the `proxy` agent for rule, middleware, or
  cache-configuration changes.
- [How to Use Navi](external/HOW_TO_USE_NAVI.md) — the cache warmer Kerghan runs after each
  release (`navi/`). Consulted by the `cache` agent for `navi_config.yaml`/resource-file
  changes — see [Cache Warmer](cache-warmer.md) for how Kerghan specifically uses it.
- [How to Use navi-hey-client](external/HOW_TO_USE_NAVI-CLIENT.md) — the CLI/library used by the
  `warm-up-cache` CircleCI job to push config into and trigger a warm-up run against a running
  Navi instance.
- [Vault](external/vault.md) — the Docker-in-Docker image that runs a `docker compose` stack
  inside a single container, shipping an app and its dependencies as one image exposing one
  port. Not used by Kerghan yet; planned for upcoming deployment work. Consulted by the `infra`
  agent for Docker/deployment changes involving Vault.
