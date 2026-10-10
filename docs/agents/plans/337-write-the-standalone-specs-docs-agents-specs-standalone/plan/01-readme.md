# Write README.md

Create `docs/agents/specs/standalone/README.md`:

- **Overview and purpose:** ship Kerghan as `darthjee/kerghan` (the production backend image, consumed
  by Render and baked into the standalone stack) and `darthjee/kerghan-standalone` (a Vault-based
  image running MySQL, the backend and Tent with the frontend in one container), plus a `kerghan`
  client and installer.
- **Product decision:** epic #336.
- **Scope / out of scope:** no Navi/cache warmer, no phpMyAdmin, no email; the production frontend
  (`kerghan.ffavs.net`) keeps its SSH deploy; standalone is for self-hosting/local use, not
  production; Render never runs the Vault image.
- **Alternatives:** Vault chosen; released compose bundle as a possible later fallback (out of
  scope); fat single image, external database and Helm/Kubernetes rejected, with reasons.
- **Repo layout:** `standalone/vault/` (inner compose + `tent/` with Tent config and frontend build),
  `standalone/bin/kerghan`, `standalone/install.sh`, `standalone/kerghan.env.example`,
  `dockerfiles/kerghan_standalone/Dockerfile`; owned by the `standalone` agent (#338), while
  CircleCI, `bin/image.sh` and `scripts/deploy.sh` stay with `infra`.
- **Known limitations:** HTTPS (the `Secure` access-token cookie works over plain HTTP only on
  `localhost`; otherwise use a TLS reverse proxy; proper handling is future work); the demo user
  exists in standalone databases (special handling in a future epic, when standalone can run
  without a password).
- **Lifecycle note:** the hub's single "last sub-issue" step is split across #347 (fold into
  permanent docs) and #348 (delete the folder and move the hub entry to Completed specs).
- **Sub-issue map:** #337–#348 with title, owner and the spec file(s) each reads.
- **Index:** links to the seven files below.
- **Required tests:** none of its own; point to each file's section.

## Files to Change
- `docs/agents/specs/standalone/README.md` — new.
