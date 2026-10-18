# Standalone Plan: User-side approval flow (backend + frontend)

Main plan: [plan.md](plan.md)

## Shared contracts

`KERGHAN_USER_APPROVAL_REQUIRED` is a **plain optional pass-through**: it reaches the backend only
when set in `~/.kerghan/kerghan.env`. The client never writes it, `update-env` never adds it, and
`kerghan up` does not refuse it.

## Implementation Steps

### Step 1 — Pass the flag through

List `KERGHAN_USER_APPROVAL_REQUIRED` by name (no value) in the `kerghan` service's `environment:`
in `standalone/vault/docker-compose.yml`, next to the other optional pass-throughs. Add it to the
"Optional pass-through (allowlist)" row of section 5 in `docs/agents/environment-variables.md`
and, if `docs/agents/standalone.md` or `standalone/config.example` enumerates pass-throughs,
there too. Extend any bats test that asserts the pass-through list (`standalone/test`).

## Files to Change
- `standalone/vault/docker-compose.yml` — pass-through entry.
- `docs/agents/environment-variables.md` — section 5 pass-through row.
- `standalone/test/*` — pass-through list assertion, if one exists.

## CI Checks

- `standalone`: the bats suite (`standalone_tests` CI job), via its docker image, never on the host.
