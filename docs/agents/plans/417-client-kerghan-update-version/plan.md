# Plan: Client: `kerghan update [VERSION]`

Issue: [417-client-kerghan-update-version.md](../../issues/417-client-kerghan-update-version.md)

## Overview

Implement `kerghan update [VERSION]` and the hidden `update --finish` step in the standalone
client (`standalone/bin/kerghan`), exactly as specified in `docs/agents/specs/client-update/`,
with a new `standalone/test/update.bats` suite. All work is owned by the `standalone` agent.

See [standalone.md](standalone.md) for the full plan.
