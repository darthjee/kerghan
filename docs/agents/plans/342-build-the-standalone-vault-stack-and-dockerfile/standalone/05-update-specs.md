# Update the specs

Bring the standalone specs in line with the decisions in issue #342:

- `stack.md`: `/vault/.env` also holds `KERGHAN_VERSION` (build arg, default `latest`); the
  `kerghan` service uses `image: darthjee/kerghan:${KERGHAN_VERSION}`; the Tent configuration
  lives in `standalone/vault/tent/configuration/` and the built frontend in
  `standalone/vault/tent/static/`; the "Required tests" CI check is a `make standalone-smoke`
  target now, with the CI job in #343.
- `images.md`: the "references `darthjee/kerghan:<v>`" test checks `/vault/.env`
  (`KERGHAN_VERSION=<v>`), not the compose file.

## Files to Change

- `docs/agents/specs/standalone/stack.md` — as above.
- `docs/agents/specs/standalone/images.md` — as above.
