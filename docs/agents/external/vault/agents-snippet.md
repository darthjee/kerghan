# Agent snippet

A ready-to-paste block for your repository's `AGENTS.md` (or `CLAUDE.md`), so coding agents
know where the Vault guides are and which rules to follow.
Back to the [Vault guides index](../vault.md).

- Copy the whole `docs/guides/` tree (`vault.md` and `vault/`) into your repository first; see
  [the guides index](../vault.md).
- The paths in the block assume the tree lives at `docs/guides/` from your repository root.
  If you copied it somewhere else, adjust every path in the block.
- Each rule names the guide page that covers it: [security.md](security.md),
  [concepts.md](concepts.md) and [configuration.md](configuration.md).

```markdown
## Vault

This project runs its `docker compose` stack inside Vault (Docker-in-Docker). Vault usage is
documented in `docs/guides/vault.md` and `docs/guides/vault/` (adjust the path if the guides
live elsewhere); read them before changing how the stack runs.

- **Privileges:** run Vault with the Sysbox runtime (`--runtime=sysbox-runc`, preferred) or
  `--privileged` (fallback). Never `--cap-add` subsets, rootless Docker, or the host's
  `docker.sock`. See `docs/guides/vault/security.md`.
- **`/vault`:** the compose project lives at `/vault` (mounted or `COPY`'d into a derived
  image); `docker compose` runs there. See `docs/guides/vault/concepts.md`.
- **Ports:** host port -> Vault port (`80` by convention) -> inner service via
  `ports: ["80:<app port>"]`. Internal services (databases, caches) publish nothing.
  See `docs/guides/vault/concepts.md`.
- **Bind mounts** in the inner compose file refer to the Vault container's filesystem, not the
  host's; relative paths resolve against `/vault`. See `docs/guides/vault/concepts.md`.
- **Secrets:** keep env files (`.vault.env`, `*.env`) out of git and never bake secrets into
  images; pass them at run time. See `docs/guides/vault/configuration.md`.
```
