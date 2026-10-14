# Plan: Standalone: command to add missing variables to an existing kerghan.env

Issue: [372-standalone-command-to-add-missing-variables-to-an-existing-kerghan-env.md](../../issues/372-standalone-command-to-add-missing-variables-to-an-existing-kerghan-env.md)

## Overview
Add `kerghan update-env` to the standalone client. It appends to an existing `~/.kerghan/kerghan.env` the keys that `ensure_env_file` writes and that the file lacks, and it never changes an existing line. All the work is in `standalone/` and its docs, so the standalone agent owns it.

See [standalone.md](standalone.md) for the full plan.
