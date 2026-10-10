# Client configuration (`~/.kerghan/`)

Read by #345. See the [README](README.md) for the feature overview and
[client.md](client.md) for the commands.

## Layout

Everything lives in one home directory, `~/.kerghan/`:

| File | Content | Mode |
|---|---|---|
| `~/.kerghan/config` | Client settings (this file's subject). Optional. | user default |
| `~/.kerghan/kerghan.env` | Secrets and backend variables passed to the stack (see [variables.md](variables.md)). | 600 |

## `config` format

Flat `key=value`, one per line, like Vault's `.vaultrc`. Blank lines and `#` comments (whole
line or trailing) are ignored; surrounding whitespace is trimmed. Parsed in plain bash, with no
host dependency.

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
| `stop-timeout` | seconds, positive integer | `60` | none | `--stop-timeout` on `up` and every `down` |
| `image-tag` | an image tag, or empty | the tag pinned in the script | none | the image tag |

An empty value means "use the default".

`image-tag` must be a valid Docker tag (`[A-Za-z0-9_.-]`, not starting with `.` or `-`, at most
128 characters) and must not end in `-offline`: the variant adds that suffix.

## Which commands read it

Only `up`, `down` and `reset` load the file, before any side effect (in `reset`, before the
confirmation prompt). `version`, `help`, `logs`, `status` and `compose` never read it, so a broken
config does not block them.

## `image-tag`

- It replaces only the version part of the tag; the `-offline` suffix is still appended for the
  offline variant (`image-tag=0.4.0` with `--offline` runs
  `darthjee/kerghan-standalone:0.4.0-offline`).
- When the resolved tag is `x.y.z` semver, `up`'s upgrade/downgrade rules (see
  [client.md](client.md#upgrade-and-downgrade)) apply against it instead of the pinned version.
- When it is not semver (e.g. `latest`), the version compare and the downgrade guard are skipped:
  `up` is a no-op when the running image reference and port match, and recreates otherwise.

## Recreation on `up`

Only the effective image (version tag and variant) and port drive `up`'s no-op / recreate
decision, resolved from flags, the config and the defaults. A changed `runtime` or
`stop-timeout` does not trigger recreation; it takes effect the next time the container is
created (`kerghan down && kerghan up` applies it now).

## Example

`standalone/config.example` is a commented example with every key, its default, its allowed
values and the flag that overrides it. It ships as a release asset (see
[installer.md](installer.md#release-assets)); users copy it to `~/.kerghan/config`.

## Precedence

CLI flag, then `~/.kerghan/config`, then the built-in default. `--offline` selects the offline
variant even when `variant=online`; with `variant=offline` in the file, a run without the flag
uses the offline variant.

## Malformed input

- A line without `=`, or an invalid value for a known key (e.g. `port=abc`, `variant=foo`): an
  error naming the file and the line number, and the command exits non-zero without touching the
  instance.
- An unknown key: a warning naming the file, line number and key; the command continues. This
  keeps an older CLI usable with a config written for a newer one.
- A missing `config` file is not an error: every key uses its default.

## Format decision

Flat `key=value` is chosen because every planned setting is flat and it parses in plain bash.
Rejected: JSON (needs `jq` on the host, not guaranteed) and YAML (needs a parser such as `yq`,
e.g. run in a container, adding a pull and latency). Reconsider only if nesting is ever needed.

## Required tests

- Precedence for each key (flag over file over default, where a flag exists).
- Defaults when the file is absent.
- Comments, blank lines and whitespace are ignored.
- Malformed lines and invalid values fail with the line number; unknown keys warn and continue.
- `--offline` overrides `variant=online`, and `variant=offline` applies without the flag.
- `runtime` / `stop-timeout` reach `vault` (`--runtime` on `up`, `--stop-timeout` on `up`,
  `down`, the recreate `down` and `reset`).
- `image-tag`: semver and non-semver tags, with both variants.
