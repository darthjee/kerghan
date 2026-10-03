# Architect Plan: Support KERGHAN_INTEGRATIONS_KEY rotation

Main plan: [plan.md](plan.md)

## Shared contracts

Documents the env var, commands and Makefile targets exactly as defined in [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Environment variables doc
In `docs/agents/environment-variables.md`:
- Add a `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` row next to `KERGHAN_INTEGRATIONS_KEY`, and update the latter's row to mention rotation.
- Fix the existing paragraph that says rotation isn't supported (around the `undecryptable` mention).
- Add a "Rotating `KERGHAN_INTEGRATIONS_KEY`" section, modelled on "Rotating `KERGHAN_SECRET_KEY`":
  - **Routine rotation:**
    1. Generate a new key with `openssl rand -base64 32`.
    2. Deploy with the new key as current and the old one in `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS`.
    3. Once every instance runs the new config, run `yarn integrations:keys:reencrypt` (`make integrations-keys-reencrypt` in dev).
    4. Run `yarn integrations:keys:status` and confirm the old key id shows `0`.
    5. Deploy again without the old key.
  - **Rolling-deploy variant:** the three-phase approach, and why. Old instances can't read rows under the new key.
  - **Compromised key:**
    1. Rotate right away and re-encrypt.
    2. Drop the old key as soon as the status shows `0`.
    3. Tell users to rotate their GitHub credentials, because re-encryption does not undo exposure.
  - **Lost previous key:** rows under it show `unknown` in status and are `undecryptable` until their owners replace them.
  - Keys must not contain commas or surrounding whitespace.

### Step 2 — Module doc, sample and summaries
- `docs/agents/modules/integrations.md`:
  - Replace the "Single key" bullet and the "#305 tracked separately" lines with the key set, lazy re-encryption and the commands.
  - In the Key id section, say that any configured key id is decryptable.
- `.env.dev.sample`: add `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS=` (empty), with a comment.
- `docs/agents/summary.md`, `docs/agents/product.md`: adjust any "single key / no rotation" wording.

## Files to Change
- `docs/agents/environment-variables.md` — new variable row and rotation procedure.
- `docs/agents/modules/integrations.md` — Key and Key id sections, and remove the #305 pointer.
- `.env.dev.sample` — the new empty variable.
- `docs/agents/summary.md`, `docs/agents/product.md` — wording, only if they claim a single key.

## Notes
- Do the docs last, after the backend has settled the script names and output format.
