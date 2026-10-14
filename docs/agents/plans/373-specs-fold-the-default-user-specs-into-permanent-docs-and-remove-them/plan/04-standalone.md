# Complete standalone.md

Compare `specs/default-user/standalone.md` and the "Standalone exposure" section of
`security.md` with `docs/agents/standalone.md`, section by section: pass-through, new
installations, `auto-login`, `bind`, unsafe combination warning, client-managed variables,
allowlist value, effective client IP, existing installations (`kerghan update-env`). Add only what
is missing.

- Keep the effective-client-IP findings measured by #371 (Docker Desktop for macOS, the
  table of outer publish and observed address, iptables DNAT, why the allowlist stays the full
  private range).
- Add a caveat for each unverified item (Linux host with and without Sysbox, full end-to-end
  check with the default-user image, Linux `bind=0.0.0.0` LAN behavior, the Docker Engine 28
  loopback check / moby#45610). Each caveat links to issue #384.
- Replace "Full design: [default-user/standalone.md](specs/default-user/standalone.md)" with a
  link to `modules/auth/default-user.md`.

## Files to Change
- `docs/agents/standalone.md` — fill gaps, add #384 caveats, replace the spec link.
