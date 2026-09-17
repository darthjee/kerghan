See [AGENTS.md](AGENTS.md) for project instructions.

## Boundaries

- Never install packages or invoke tooling (`yarn`, `npm`, `php`, etc.) directly on the host
  machine — always run through `docker-compose` (unless the user explicitly asks otherwise).
- Never add GitHub credential storage without an explicit product decision backing it — GitHub
  data is read unauthenticated (public-repo only) for now.
- Keep backend controllers thin — business logic belongs in each module's service, not the
  controller, unless a change explicitly documents why an exception is warranted.
