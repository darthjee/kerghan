# Plan: Client: `kerghan wizard`

Issue: [405-client-kerghan-wizard.md](../../issues/405-client-kerghan-wizard.md)

## Overview
Add `kerghan wizard [--advanced]` to the standalone client (`standalone/bin/kerghan`). It is a
thin interactive layer over the batch writer added by #404: it asks the questions, collects
the answers into a batch in memory, prints the change list with a `[Y/n]` confirmation, and
then writes through `batch_apply`. Only the standalone agent has work. The permanent docs
(`docs/agents/standalone.md`, root `README.md`) are left to #406.

See [standalone.md](standalone.md) for the full plan.
