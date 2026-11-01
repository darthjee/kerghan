# Plan: Client: `restart-on-update` setting

Issue: [416-client-restart-on-update-setting.md](../../issues/416-client-restart-on-update-setting.md)

## Overview
Add the `restart-on-update` config key (`ask` | `always` | `never`, default `ask`) to the `kerghan` standalone client: parser and shared writer helpers, `kerghan configure` (with its own apply hint), an always-asked `kerghan wizard` question after `bind`, the `usage` text and `standalone/config.example`, plus bats coverage. All work is inside `standalone/`, owned by the `standalone` agent.

See [standalone.md](standalone.md) for the full plan.
