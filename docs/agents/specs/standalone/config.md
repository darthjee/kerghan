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

| Key | Values | Default | Overridden by |
|---|---|---|---|
| `port` | 1–65535 | `3000` | `-p PORT` |
| `variant` | `online` \| `offline` | `online` | `--offline` |
| `runtime` | `auto` \| `sysbox` \| `privileged` | `auto` | none |
| `stop-timeout` | seconds, positive integer | `60` | none |
| `image-tag` | an image tag, or empty | the tag pinned in the script | none |

An empty value means "use the default".

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
