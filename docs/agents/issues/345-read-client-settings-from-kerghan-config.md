# Issue: Read client settings from ~/.kerghan/config

## Description

Part of epic #336. Let the `kerghan` client (`standalone/bin/kerghan`, from #344) read persistent
settings from `~/.kerghan/config`, so things like the port do not have to be passed on every
command. The full contract is in `docs/agents/specs/standalone/config.md`.

**Owner:** standalone (`standalone/bin/kerghan`, its bats tests, the example config).

**Depends on:** #344 (the `kerghan` CLI, merged).

## Problem

The client only knows built-in defaults and CLI flags. A user who runs Kerghan on another port,
always wants the offline variant, has no Sysbox, needs a longer stop timeout, or wants to pin a
different image tag must repeat that on every command, and some of these (runtime, stop timeout,
image tag) cannot be set at all.

## Expected Behavior

### File and format

- `~/.kerghan/config`, optional. Flat `key=value`, one per line, like Vault's `.vaultrc`.
  Blank lines and `#` comments (whole line or trailing) are ignored; surrounding whitespace is
  trimmed. Parsed in plain bash (3.2-compatible), with no host dependency.
- An empty value means "use the default".

```
port=3000
variant=online        # online | offline
runtime=auto          # auto | sysbox | privileged
stop-timeout=60
image-tag=            # optional override of the pinned image tag
```

| Key | Values | Default | Overridden by | Passed to Vault as |
|---|---|---|---|---|
| `port` | 1–65535 | `3000` | `-p PORT` | `-p <port>:80` (and `FRONTEND_BASE_URL`) |
| `variant` | `online` \| `offline` | `online` | `--offline` | the `-offline` image suffix |
| `runtime` | `auto` \| `sysbox` \| `privileged` | `auto` | none | `--runtime` on `up` |
| `stop-timeout` | positive integer (seconds) | `60` | none | `--stop-timeout` on `up` and every `down` |
| `image-tag` | an image tag, or empty | the pinned `KERGHAN_VERSION` | none | the image tag |

### Precedence

CLI flag, then `~/.kerghan/config`, then the built-in default. `--offline` selects the offline
variant even with `variant=online`; `variant=offline` applies without the flag.

### Malformed input

- A line without `=`, or an invalid value for a known key (e.g. `port=abc`, `variant=foo`):
  an error naming the file and line number; the command exits non-zero without touching the
  instance.
- An unknown key: a warning naming the file, line number and key; the command continues (an
  older CLI stays usable with a newer config).
- A missing file is not an error: every key uses its default.

### Other behavior

### `image-tag`

- It replaces only the version part of the tag; the `-offline` suffix is still appended for the
  offline variant (e.g. `image-tag=0.4.0` + `--offline` → `darthjee/kerghan-standalone:0.4.0-offline`).
- When the resolved tag is `x.y.z` semver, `up`'s usual upgrade/downgrade rules apply against it
  (instead of the pinned `KERGHAN_VERSION`).
- When it is not semver (e.g. `latest`), the version compare and downgrade guard are skipped: `up`
  is a no-op when the running image reference and port match, and recreates otherwise.

### Recreation on `up`

- Only the effective image and port drive `up`'s no-op / recreate decision (as in #344), now
  resolved from flags, config and defaults.
- A changed `runtime` or `stop-timeout` does not trigger recreation; it takes effect the next time
  the container is created (`kerghan down && kerghan up` applies it now). Document this.

### Other behavior

- The port-in-use hint mentions both `-p <port>` and `port=` in `~/.kerghan/config`.
- A commented example ships as `standalone/config.example`, next to `kerghan.env.example`. Update
  the spec (`README.md` file table, `installer.md` release assets, `config.md`) so the installer
  sub-issue ships it as a release asset.

### Tests (bats, `standalone/test/`)

- Precedence for each key (flag over file over default, where a flag exists); defaults when the
  file is absent.
- Comments, blank lines and whitespace are ignored; empty values fall back to defaults.
- Malformed lines and invalid values fail with the line number and touch nothing; unknown keys
  warn and continue.
- `--offline` overrides `variant=online`; `variant=offline` applies without the flag.
- `runtime` / `stop-timeout` reach `vault` (`--runtime` on `up`, `--stop-timeout` on `up`,
  `down`, the recreate `down` and `reset`).
- `image-tag`: semver and non-semver tags, with both variants.

### Format decision

Flat `key=value`. JSON (needs `jq` on the host) and YAML (needs a parser such as `yq`) were
rejected; every planned setting is flat.

## Benefits

- Persistent per-host settings without retyping flags.
- Exposes Vault's runtime and stop-timeout controls, needed on hosts without Sysbox or with slow
  shutdowns.
- No new host dependency.
