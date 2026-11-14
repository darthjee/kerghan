See [AGENTS.md](AGENTS.md) for project instructions.

## Boundaries

- Never install packages or invoke any package manager or language runtime (e.g. `yarn`, `npm`,
  `php`) directly on the host machine — always run it through `docker-compose`. The only exception
  is a specific command the user has explicitly allowed on the host, either in their message in the
  current conversation or through a standing user instruction (for example a user memory entry).
- Store GitHub credentials only as integrations, exactly as defined by the integrations entry in
  `docs/agents/specs.md` (encrypted at rest as defined there; #295 is the product decision). Any
  other GitHub credential storage still needs an explicit product decision backing it. Issue
  fetching itself still reads GitHub unauthenticated (public-repo only), in the browser.
- GitHub credentials stay in the backend: every GitHub call that uses a user's credential is made
  by the backend inside the Integrations module, and no endpoint returns a credential or anything
  derived from it beyond the masked `secretHint`. The backend lists repositories with an
  integration's credential or a GitHub handle's public listing; the frontend never calls GitHub
  with a credential.
- Keep backend controllers thin — business logic belongs in each module's service, not the
  controller, unless a change explicitly documents why an exception is warranted.
