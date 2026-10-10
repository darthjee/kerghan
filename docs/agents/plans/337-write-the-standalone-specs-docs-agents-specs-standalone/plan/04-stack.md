# Write stack.md

Create `docs/agents/specs/standalone/stack.md`:

- Vault basics relevant here (link `docs/agents/external/vault/`): compose runs from `/vault`;
  bind mounts resolve against the Vault container; data persists in `/var/lib/docker`.
- Inner services: `mysql` (internal only, healthcheck, data in an inner named volume); `kerghan`
  (`darthjee/kerghan:<v>`, runs migrations on boot, `depends_on: { mysql: { condition: service_healthy } }`,
  `restart: unless-stopped`); `tent` (stock image via `image: ${TENT_IMAGE}`, Tent standalone config
  and the built frontend from `/vault/tent/` bind-mounted, `$backendHost=http://kerghan:<port>`,
  published on Vault port 80, `restart: unless-stopped`).
- Multi-arch Tent: the Dockerfile uses `TARGETARCH` to write `/vault/.env` with
  `TENT_IMAGE=darthjee/tent:1.0.3` or `darthjee/tent:1.0.3-arm64` (compose reads it automatically;
  no secrets). Upstream multi-arch Tent manifest is an optional follow-up.
- Dockerfile targets: `standalone` (`FROM darthjee/vault:0.1.0`, copies `standalone/vault/` with
  the built frontend to `/vault`) and `standalone-offline` (`FROM standalone`, adds `images/*.tar`
  to `/vault/images/`, `ENV COMPOSE_UP_ARGS="--pull never"`). `.dockerignore` excludes env files;
  no secret is baked.
- Offline preload: tarballs are Vault's only supported mechanism; alternatives rejected (list);
  accepted costs (double storage, `docker load` on each start); CI saves the arch-matching tags.
- Same-origin: Tent serves frontend and API from one origin; CORS stays disabled; modern browsers
  pass `OriginGuard` via `Sec-Fetch-Site`; older ones need `FRONTEND_BASE_URL` (set by the client).
- Edge cases: first-boot ordering; switching online/offline on the same volume is supported;
  disk growth from old inner images (documented manual cleanup); unsupported environments
  (Windows, rootless Docker, no Sysbox and no `--privileged`).
- **Required tests:** CI boots the image with `--privileged`, waits for the stack, and checks the
  backend health endpoint and the frontend through Tent on port 80; data survives a restart with
  the volume kept; the offline variant starts with no network on amd64 and arm64.

## Files to Change
- `docs/agents/specs/standalone/stack.md` — new.
