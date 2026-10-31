## Description

Second sub-issue of the client config Epic (#402). Depends on the specs sub-issue (the first
sub-issue of #402), merged.

Implement, in the `kerghan` client (`standalone/bin/kerghan`), the shared layer that reads,
validates and writes both `~/.kerghan/config` and `~/.kerghan/kerghan.env`, and the
`kerghan configure` command on top of it, as defined in
`docs/agents/specs/client-config/` (`README.md`, `files.md`, `configure.md`, `security.md`).

## Scope

In scope:

- The shared writer layer in `standalone/bin/kerghan`: key routing, reading, validation, line
  editing, atomic writes, permissions and symlinks, as defined in `files.md`.
- `cmd_configure` with its three forms (list, single read, write), `--show-secrets`, `--force`,
  `--unset` and `KEY=-`.
- The two `usage` lines, copied verbatim from `configure.md`.
- bats tests in `standalone/test/` for every "Required tests" item in `files.md`,
  `configure.md` and `security.md`.

Out of scope:

- `kerghan wizard` (#405). The writer only has to be callable by it; no wizard prompts,
  questions or summary are built here.
- Permanent docs (#406): `docs/agents/standalone.md`, `standalone/config.example` and the root
  `README.md` stay untouched, and `docs/agents/specs/client-config/` stays in place.
- Changes to existing commands. `up`, `down`, `reset`, `update-env` and `ensure_env_file` keep
  their current code and behavior, and are **not** moved onto the new writer here, even where
  the logic overlaps (env appending, `chmod 600`). That refactor is #408.
- Installer, Dockerfiles, Vault, CircleCI, and anything outside `standalone/bin/kerghan` and
  `standalone/test/`.
- A `--json` listing, and running or recreating the instance.

## Problem

Users can only change the client configuration by hand-editing `~/.kerghan/config` (copied
from `standalone/config.example`) and `~/.kerghan/kerghan.env`. There is no way to see the
effective value of a setting, and nothing validates a change before the next `kerghan up`.

## Expected Behavior

- `kerghan configure` lists every config and env value with its source, secrets masked
  (`--show-secrets` unmasks).
- `kerghan configure <key>` prints one value (masked for secrets unless `--show-secrets`).
- `kerghan configure key=value [key=value...]` validates every value with the client's
  existing validators, then writes all or nothing, printing `key: old -> new`
  (`<KEY>: changed` for secrets) and the apply hint.
- `kerghan configure --unset <key>` returns a key to its default.
- `KEY=-` reads the value with hidden input from the TTY, or from stdin when piped.
- `KERGHAN_SECRET_KEY` / `KERGHAN_INTEGRATIONS_KEY` need `--force` (with a `[y/N]` confirmation
  on a TTY); the client-managed `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` /
  `KERGHAN_DEFAULT_USER_ALLOWED_IPS` are refused.
- Every edge case and security rule in the specs behaves as defined (missing files, invalid /
  duplicate / commented-out lines, unknown keys, permissions, atomic writes, symlinks,
  cross-key warnings).
- `usage` documents the command. Existing commands are unchanged.

## Solution

- Add a writer for both files (read the lines, replace / uncomment / append / remove the
  touched key, write to a temp file in the same directory under a restrictive umask, rename
  into place, keep the mode, write through symlinks). It is the layer the `wizard` sub-issue
  reuses.
- Structure the writer as functions that are independent of `cmd_configure`, so #405 calls
  them directly (function names are left to the implementer):
  - read the effective value and source of a key (shared by the listing, the single read and
    the wizard defaults);
  - validate a batch of changes (sets and unsets) and report every problem without writing;
  - apply a validated batch (atomically per file);
  - print the change list, apply hint and cross-key warnings for a batch;
  - one `is_tty` helper (stdin is a terminal), used by `KEY=-`, the `--force` confirmation and
    the wizard.
- Add `cmd_configure` reusing `load_config`, the `valid_*` validators, `ensure_env_file`,
  `volume_exists` and `DEFAULT_ENV_KEYS`.
- bats tests in `standalone/test/` covering every "Required tests" item in `files.md`,
  `configure.md` and `security.md`.
- Owned by the standalone agent.
