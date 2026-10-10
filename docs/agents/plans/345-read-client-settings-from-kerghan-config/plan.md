# Plan: Read client settings from ~/.kerghan/config

Issue: [345-read-client-settings-from-kerghan-config.md](../../issues/345-read-client-settings-from-kerghan-config.md)

## Overview
Teach `standalone/bin/kerghan` to read an optional flat `key=value` file, `~/.kerghan/config`
(`port`, `variant`, `runtime`, `stop-timeout`, `image-tag`), with flag > file > default
precedence, pass `runtime` / `stop-timeout` through to Vault, ship `standalone/config.example`,
and cover it all with bats tests. Single owner: the `standalone` agent.

See [standalone.md](standalone.md) for the full plan.
