# integrations.md

Create `docs/agents/specs/repos/integrations.md` — what the Repositories feature needs from the Integrations module (`docs/agents/modules/integrations.md`, which today exports nothing).

Decided:

- The Integrations module **exports a service that performs authenticated GitHub requests for a given (user, integration)**; the decrypted credential never leaves the module; the Repositories module never sees it.
- Used for: listing the repos an integration can see, fetching the handle's public repos through a valid integration, and the Add re-check (`GET /repositories/{id}`).
- A `401` from GitHub sets the integration `invalid`; other errors are reported back as a fixed set of statuses, never by echoing GitHub bodies.
- Access-link choice on Add: the oldest non-`invalid` integration that sees the repo; no auth when only the public source sees it.
- On integration deletion, the Repositories module is told so it can clear `integration_id` and drop source rows (logical FKs, no cascade).
- Integration types in scope: `pat`, `oauth_app`, `github_app`.

Open markers (all #448): exported interface, per-type authentication (incl. GitHub App installation-token minting/caching), GitHub endpoint and parameters per type, error mapping, deletion-hook mechanism (call vs event).

End with **Required tests** for the decided rules (credential never returned by the exported service, `401 → invalid`, access-link choice, deletion notifies Repositories).

## Files to Change
- `docs/agents/specs/repos/integrations.md` — new.
