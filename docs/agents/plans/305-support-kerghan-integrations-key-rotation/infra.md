# Infra Plan: Support KERGHAN_INTEGRATIONS_KEY rotation

Main plan: [plan.md](plan.md)

## Shared contracts

**Relies on** the backend's `integrations:keys:status` and `integrations:keys:reencrypt` package scripts. They run `node dist/integrations/cli/integrations-keys.js ...`, so a build is needed first in dev.

**Produces** `make integrations-keys-status` and `make integrations-keys-reencrypt`.

## Implementation Steps

### Step 1 — Makefile targets
Add the two targets in the Development section and list them in `.PHONY`:

```make
integrations-keys-status:
	docker-compose run --rm $(PROJECT)_app sh -c "yarn build && yarn integrations:keys:status"

integrations-keys-reencrypt:
	docker-compose run --rm $(PROJECT)_app sh -c "yarn build && yarn integrations:keys:reencrypt"
```

`kerghan_app` bind-mounts `./backend`, so the build runs against the live source. In production (Render), `dist/` is already built in the image, and operators run `yarn integrations:keys:status` or `yarn integrations:keys:reencrypt` from a shell on the service.

### Step 2 — Confirm no compose, CI or Dockerfile change
`env_file: .env` / `.env.prod` already forward `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` when it is set. CI leaves it unset, which means empty. The production image already ships `dist/`. Don't change `entrypoint.sh`: re-encryption must stay an explicit operator action, never an automatic boot step.

## Files to Change
- `Makefile` — the two targets and `.PHONY`.

## Notes
- Running the targets needs a reachable MySQL (`kerghan_mysql`), the same as `make setup`.
