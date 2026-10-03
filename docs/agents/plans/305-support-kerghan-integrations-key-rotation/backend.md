# Backend Plan: Support KERGHAN_INTEGRATIONS_KEY rotation

Main plan: [plan.md](plan.md)

## Shared contracts

**Produces:**
- The `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` parsing and validation rules.
- The `integrations:keys:status` and `integrations:keys:reencrypt` package scripts, with their output and exit codes.

Both contracts are defined exactly in [plan.md](plan.md#shared-contracts).

**Relies on:** infra wiring the `Makefile` targets. Nothing in the backend depends on them.

## Steps

- [01 — Integrations key set](backend/01-integrations-key-set.md)
- [02 — Multi-key decryption and re-encryption in the encryption service](backend/02-multi-key-encryption.md)
- [03 — Lazy re-encryption on connection test](backend/03-lazy-reencryption.md)
- [04 — Key rotation service and CLI commands](backend/04-rotation-service-and-cli.md)

## CI Checks
Run inside docker-compose, never on the host:
- `backend`: `docker-compose run --rm kerghan_tests yarn lint`
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage`

## Notes
- Keep the controller untouched. No HTTP endpoint is added: rotation is operator-only, through the CLI.
- No migration is needed. `secret_key_id` (`char(8)`, indexed) already exists.
- Follow the DI rule: env vars are read only in the `INTEGRATIONS_KEY` factory, never inside classes or the CLI logic.
