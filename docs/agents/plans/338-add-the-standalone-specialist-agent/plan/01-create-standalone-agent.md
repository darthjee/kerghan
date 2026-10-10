# Create the standalone agent

Create `.claude/agents/standalone.md`, following the format of `infra.md`, `proxy.md` and
`cache.md`:

- Frontmatter: `name: standalone`, `tools: Read, Edit, Write, Bash`, and a `description` specific
  enough to route standalone work to it — e.g. "Kerghan standalone-distribution specialist. Use
  for any task involving the Vault-based `darthjee/kerghan-standalone` image: `standalone/`
  (inner compose stack, Tent standalone config, `kerghan` client CLI, installer, env example),
  `dockerfiles/kerghan_standalone/Dockerfile`, or how Vault is used. CircleCI release jobs,
  `bin/image.sh` and `scripts/deploy.sh` stay with the infra agent."
- `## Your scope`:
  - `standalone/vault/` — inner compose file and `tent/` (Tent standalone configuration),
    copied to `/vault` in the image;
  - `standalone/bin/kerghan` — the client CLI;
  - `standalone/install.sh` — the installer;
  - `standalone/kerghan.env.example` — example env file shipped as a release asset;
  - `dockerfiles/kerghan_standalone/Dockerfile` — targets `standalone` and `standalone-offline`;
  - how Vault is used (Docker-in-Docker, Sysbox/`--privileged`).
- Boundaries ("Do NOT touch"): `.circleci/config.yml`, `bin/image.sh`, `scripts/deploy.sh`,
  `docker-compose.yml` and the other `dockerfiles/` (→ `infra`); `backend/`, `frontend/`,
  `proxy/`, `navi/` (→ their specialists).
- The no-host-tooling rule (run everything through `docker-compose`/the relevant image).
- `## References`: the Vault guide via the `docs/agents/external.md` hub entry, and the
  standalone specs **only** via the "Standalone distribution" entry in `docs/agents/specs.md`
  — never a direct link to `docs/agents/specs/standalone/`.

## Files to Change

- `.claude/agents/standalone.md` — new agent definition.
