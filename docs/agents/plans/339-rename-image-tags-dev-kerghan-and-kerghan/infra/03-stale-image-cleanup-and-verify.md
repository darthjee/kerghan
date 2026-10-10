# Document the stale-image cleanup and verify

Developers who built the dev image before this change still have it tagged `darthjee/kerghan`.
`base_prod` would then run that stale dev image under the production tag without rebuilding.

- Add a short one-time cleanup note to `.claude/agents/infra.md` (near the leaf image paragraph)
  and to `docs/agents/architecture/infra.md`: run `docker image rm darthjee/kerghan`, then rebuild
  with `docker-compose build base_prod_build` (and `base_build` for the dev image).
- Repeat the note in the PR description.
- Verify through docker-compose only (never on the host):
  - `docker-compose build base_build` produces `darthjee/dev_kerghan`; `make tests` /
    `docker-compose run kerghan_tests` still start.
  - `docker-compose build base_prod_build` produces `darthjee/kerghan`; `docker-compose run
    base_prod` (the production sanity check) still starts.
  - The `make build` recipe (read it, don't run it on the host) tags only `darthjee/dev_kerghan`.

## Files to Change
- `.claude/agents/infra.md` — one-time cleanup note.
- `docs/agents/architecture/infra.md` — one-time cleanup note.
