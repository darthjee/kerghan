# Plan: Client: shared config/env writer + `kerghan configure`

Issue: [404-client-shared-config-env-writer-kerghan-configure.md](../../issues/404-client-shared-config-env-writer-kerghan-configure.md)

## Overview
Add to `standalone/bin/kerghan` a shared writer for `~/.kerghan/config` and
`~/.kerghan/kerghan.env`, built as standalone functions the wizard (#405) can reuse, and the
`kerghan configure` command on top of it, with the bats tests the client-config specs require.
Only the `standalone` agent has work.

See [standalone.md](standalone.md) for the full plan.
