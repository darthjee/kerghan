# Write docs/agents/standalone.md

Create the permanent reference for the standalone distribution, replacing the specs as the source
for agents and maintainers. Draw on `specs/standalone/{README,client,config,installer,stack,images}.md`,
keep only what describes shipped behavior, and drop the spec-only parts: sub-issue map,
"Read by #…" headers, "Required tests" sections, lifecycle.

Sections:

1. **Overview**: the two public images (`darthjee/kerghan`, `darthjee/kerghan-standalone` online
   and `-offline`), the `kerghan` client and the installer. Also the chosen approach and the
   rejected alternatives (from the spec README "Alternatives"), and what is out of scope
   (Navi, phpMyAdmin, email, production use).
2. **Requirements**: Linux or macOS, Docker with Sysbox or `--privileged`, and the client's host
   dependencies (`vault`, `docker`, `openssl`). Windows and rootless Docker are unsupported.
3. **Install and upgrade**: the one-liner, what `install.sh` does (the steps, `vault` pinned to
   the base Vault version, no `sudo`), `KERGHAN_VERSION` / `KERGHAN_INSTALL_DIR`, the errors, a
   rerun upgrading in place, and verifying the release assets with `SHA256SUMS` (Linux and
   macOS commands). Then upgrading the instance (install the new CLI, `kerghan up` recreates it,
   migrations run on boot). Downgrades are unsupported, with a warning.
4. **The `kerghan` client**: the command list, how each command maps to `vault`
   (`vault-kerghan` container, `vault-kerghan-data` volume), secret generation on the first `up`,
   the refusal when `kerghan.env` is missing but the volume exists, the default
   `FRONTEND_BASE_URL`, `reset`, and the port-in-use hint.
5. **Configuration (`~/.kerghan/`)**: the layout table (`config`, `kerghan.env` mode 600); the
   `config` format; the key table (`port`, `variant`, `runtime`, `stop-timeout`, `image-tag`);
   which commands read it; precedence; `image-tag` rules; what triggers a recreation;
   malformed-input handling; and `config.example` as a release asset.
6. **Inner stack**: the services table (`mysql`, `kerghan`, `tent`), the Tent standalone
   configuration mirroring `proxy/prod_configuration/` (and the need to keep them in sync), the
   bind-mounted `/vault/tent/` (configuration, static frontend, extension copied from
   `proxy/extension/`), multi-arch Tent via `/vault/.env`, the Dockerfile targets, the offline
   tarball preload, and same-origin / `OriginGuard`.
7. **Images and versioning**: the tag table, the image version pinned to the git semver tag,
   standalone `<v>` bundling `darthjee/kerghan:<v>`, and the pinned inner images. Link to
   `architecture/infra.md` for the CI jobs instead of repeating them.
8. **Caveats**: HTTPS / `Secure` cookie (plain HTTP only on `localhost`, otherwise a TLS
   reverse proxy); back up `~/.kerghan/kerghan.env`; the MySQL password is fixed at volume
   creation; disk growth, with a concrete manual cleanup command (verify it against the shipped
   client, e.g. `docker exec vault-kerghan docker image prune -a`, or the
   `kerghan compose` equivalent); no downgrades; one instance per host; the demo user in
   standalone databases (a future epic will handle it); a failed migration seen through
   `kerghan status` / `kerghan logs`.
9. **Testing**: `make build-standalone`, `make standalone-smoke`, `standalone/scripts/smoke_test.sh`
   and the client/installer test suites under `standalone/test/`.

Link to `environment-variables.md#standalone` for the env contract instead of duplicating it.
Never link to `specs/standalone/`.

Then register the doc:

- `docs/agents/index.md`: add `- [Standalone Distribution](standalone.md)` under "Architecture".
- `docs/agents/summary.md`: add a matching abstract in its "Architecture" section.

## Files to Change

- `docs/agents/standalone.md` — new permanent reference
- `docs/agents/index.md` — link to the new doc
- `docs/agents/summary.md` — abstract of the new doc
