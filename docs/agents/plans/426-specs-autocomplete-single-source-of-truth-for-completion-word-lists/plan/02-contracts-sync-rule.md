# contracts.md: sync-rule enforcement

In `docs/agents/specs/auto-complete/contracts.md`, under `## Sync rule`, keep the rule's wording and replace the `> **Open — settled by #426:**` block with how it's enforced:

- The sync tests from [completion.md](completion.md#word-lists) enforce the rule:
  - The generated lists are compared with the constants, after sourcing the client.
  - The hand-written lists are cross-checked against `kerghan help`.
  - Every config key is classified as free-form or fixed-value.

  A PR that adds a command, flag, key or value without updating completion fails these tests.
- **The new constants aren't contracts.** The value constants and the `FRONTEND_BASE_URL` constant added by #434 are internal to `standalone/bin/kerghan`, and so are `CONFIG_KEYS` and `DEFAULT_ENV_KEYS`. Their names may change, and the sync tests change with them.
- **The `BASH_SOURCE` guard is an internal test contract.** The client can be sourced without running `main`, and the sync tests rely on that. #434 documents this in the client header, next to the bash 3.2 rule. It isn't user-facing.

Under `## Required tests`, add one line: a client change that adds a word without updating completion makes the sync tests fail.

## Files to Change
- `docs/agents/specs/auto-complete/contracts.md` — `## Sync rule` gets its enforcement, the internal-constants note and the `BASH_SOURCE` note; `## Required tests` gets one line.
