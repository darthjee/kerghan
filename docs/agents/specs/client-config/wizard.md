# Client config: `kerghan wizard`

The interactive command: one question per setting, the current value as the default, a summary
and a confirmation before anything is written. Part of the [client config specs](README.md).
It writes through the same writer as `kerghan configure`, so every rule of
[files.md](files.md) applies; secret handling is in [security.md](security.md).

## Usage

The client `usage` gets this line in its "Commands:" list, verbatim (#405 copies it), after the
`configure` lines:

```
  wizard [--advanced]             set up the settings interactively (--advanced asks every setting)
```

Any other option or argument is a usage error (exit `2`).

## Questions

Asked in this order; `+` marks the questions only asked with `--advanced`:

| # | Question | Key | File |
|---|----------|-----|------|
| 1 | Port | `port` | config |
| 2 | Image variant (online / offline) | `variant` | config |
| 3 + | Docker runtime (auto / sysbox / privileged) | `runtime` | config |
| 4 + | Stop timeout (seconds) | `stop-timeout` | config |
| 5 + | Image tag | `image-tag` | config |
| 6 | Automatic login (true / false) | `auto-login` | config |
| 7 | Bind address | `bind` | config |
| 8 + | Default user enabled (true / false) | `KERGHAN_DEFAULT_USER_ENABLED` | env |
| 9 + | Default user is admin (true / false) | `KERGHAN_DEFAULT_USER_ADMIN` | env |
| 10 | Default user username | `KERGHAN_DEFAULT_USER_USERNAME` | env |
| 11 | Default user email | `KERGHAN_DEFAULT_USER_EMAIL` | env |
| 12 | Default user password (keep / generate / type) | `KERGHAN_DEFAULT_USER_PASSWORD` | env |
| 13 + | Public URL | `FRONTEND_BASE_URL` | env |

Rules:

- **`bind` after `auto-login`.** The bracketed default of `bind`, when it has no line in
  `config`, is the one derived from the auto-login answer (`127.0.0.1` when on, `0.0.0.0` when
  off).
- **Skipping the default user.** When automatic login ends up off **and**
  `KERGHAN_DEFAULT_USER_ENABLED` is `false` (its answer with `--advanced`, its current value
  otherwise), nothing uses the default user: questions 9–12 are skipped. There is no conflict
  check between the two: automatic login implies an enabled default user (the backend's
  `ALWAYS_AUTHENTICATED` implies enabled, see
  [default-user.md](../../modules/auth/default-user.md#configuration)).
- **Public URL.** Asked as `Public URL [http://localhost:<port>, derived from port]` (with the
  port answer) when `kerghan.env` has no `FRONTEND_BASE_URL`, or with its current value. Enter
  keeps the current value; nothing is written when it was never set.
- **Never asked:** `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY` (see
  [security.md](security.md#changing-the-secrets)), the client-managed pair, and custom env
  variables. Those are handled by `kerghan configure` only.

## Prompts

Each prompt shows the current value (or the default) in brackets; prompts go to stderr, answers
are read from stdin.

```
Port [3000]: 3002
Image variant (online/offline) [online]:
Automatic login (true/false) [true]: false
Bind address [0.0.0.0, derived from auto-login]:
Default user username [admin]:
Default user email [admin@kerghan.local]: me@example.com
Default user password: (k)eep, (g)enerate or (t)ype? [k]:
```

- **Enter keeps the bracketed value.** When the key has no line (the default applies), Enter
  writes nothing: the key stays unset, so a later change of the default still reaches it.
- **An invalid answer re-asks** the same question, after the validator's message on stderr
  (the `valid_*` validators for config keys, the known env key rules of
  [files.md](files.md#values)). An empty answer is never an invalid answer: it is Enter.
- **An invalid current value** (an invalid `config` line, [files.md](files.md#existing-content)
  case 4) is shown as invalid and the default is offered instead: `Port [3000] (current value
  'abc' is invalid):`. Enter then writes the default, which fixes the line.
- **Booleans** accept `true` / `false` (and `y` / `n`, written as `true` / `false`).

### Password

```
Default user password: (k)eep, (g)enerate or (t)ype? [k]:
```

- **(k)eep** (the default): no change.
- **(g)enerate:** a new password from the same generator as `up` (48 hex characters). It is
  never printed; after the write the wizard says the new password is in
  `~/.kerghan/kerghan.env`.
- **(t)ype:** asked with hidden input, twice; a mismatch says so and asks both again; a
  password shorter than 8 characters is re-asked.

When `kerghan.env` has no password (a file from an older client, or no file yet), `keep` is not
offered and the default is `(g)enerate`.

## Starting state

Checked before the first question; any failure exits `1` and asks nothing:

- **No TTY.** Without a terminal on stdin the wizard fails with an error pointing to
  `kerghan configure` for scripted changes.
- **No `kerghan.env` with a data volume** ([files.md](files.md#missing-files) case 3): the
  restore / `kerghan reset` hint, plus a pointer to `kerghan configure` for config-only changes.
- **A `config` line without `=`**: the line number and a request to fix it by hand.

With no `kerghan.env` and no data volume, the env questions offer the values a new file gets
(username `admin`, email `admin@kerghan.local`, a generated password); the write creates the
file as `up` does and applies the answers ([files.md](files.md#missing-files) case 2).

The TTY check is a single helper (stdin is a terminal), also used by `configure`'s `KEY=-` and
`--force` confirmation. Tests drive the wizard through stdin with the test-only override
`KERGHAN_ASSUME_TTY=true`, which makes that helper answer "terminal"; it is not listed in the
usage or the user docs.

## Summary and confirmation

After the last question, nothing has been written yet. The wizard prints the change list
([files.md](files.md#change-list), secrets as `<KEY>: changed`, see
[security.md](security.md#masking)) and asks:

```
port: 3000 (default) -> 3002
auto-login: true (default) -> false
KERGHAN_DEFAULT_USER_EMAIL: admin@kerghan.local -> me@example.com
Write these changes? [Y/n]
```

- **`Y` / Enter:** writes everything (all or nothing, [files.md](files.md#writing)), then
  prints the apply hint and any cross-key warning ([security.md](security.md#cross-key-warnings)).
- **`n`:** prints `Nothing written.` and exits `0`.
- **No change at all:** prints `Nothing changed.` and exits `0` without asking.

## Abort

- **Ctrl-C** at any point before the write: nothing is written, exit `130`.
- **End of input** before the confirmation: nothing is written, an error says the input ended,
  exit `1`.
- **A running instance** needs no special handling: the wizard never touches it, and the apply
  hint says how to apply the change.

## Required tests

All driven through stdin with `KERGHAN_ASSUME_TTY=true`, unless stated.

- Without `KERGHAN_ASSUME_TTY` and with stdin from a pipe, the wizard exits `1` pointing to
  `kerghan configure` and prints no question.
- An unknown option exits `2`.
- Without `--advanced`, questions 1, 2, 6, 7, 10, 11, 12 are asked in that order; with it, all
  thirteen in table order.
- Enter on every question with no `config` writes nothing and prints `Nothing changed.`.
- Answering `port` `3002` and confirming writes `port=3002`, prints the change list and the
  `kerghan up` hint.
- The `bind` default follows the auto-login answer (`127.0.0.1` / `0.0.0.0`); Enter on it
  writes no `bind` line.
- Auto-login `false` with `KERGHAN_DEFAULT_USER_ENABLED=false` skips the default user
  questions; auto-login `true` asks them.
- An invalid port answer re-asks; the next valid answer is written.
- An invalid `runtime` line in `config` is shown as invalid with the default offered; Enter
  writes the default and the file loads again.
- Password `g` writes a 48-hex-character password, never prints it, and says it is in
  `kerghan.env`; `t` with two matching answers writes it; a mismatch re-asks; a 7-character
  typed password re-asks.
- With no password in `kerghan.env`, `keep` is not offered.
- `--advanced` public URL: Enter with no `FRONTEND_BASE_URL` writes nothing; an answer writes
  it.
- The summary shows the password as `KERGHAN_DEFAULT_USER_PASSWORD: changed`.
- Answering `n` prints `Nothing written.`, exits `0`, and both files are byte for byte
  unchanged.
- End of input after question 2 writes nothing and exits `1`.
- With no `kerghan.env` and no volume, the wizard creates it as `up` does with the answers
  applied; with a volume, it exits `1` before the first question.
- The secrets are never asked.
- The wizard makes no `vault` call.
