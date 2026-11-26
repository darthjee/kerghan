# Plan: Standalone: add a kerghan diagnose command

Issue: [597-standalone-add-a-kerghan-diagnose-command.md](../../issues/597-standalone-add-a-kerghan-diagnose-command.md)

## Overview

Add a read-only, client-side `kerghan diagnose` command to `standalone/bin/kerghan`. It checks the
container and the inner services, probes `/health.json` and `/ready.json` on the published address
and on the advertised URL, lists the port's listeners, and ends with one verdict and an exit code
(0–6). Help, completion, `up`'s port conflict hint, the bats suite and the standalone docs are
updated with it. The whole change is in the standalone agent's scope.

See [standalone.md](standalone.md) for the full plan.
