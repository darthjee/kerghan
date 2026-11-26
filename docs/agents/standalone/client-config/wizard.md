# Client config: `kerghan wizard`

Part of [Client config](../client-config.md).

### Usage

```
  wizard [--advanced]             set up the settings interactively (--advanced asks every setting)
```

Any other option or argument is a usage error (exit `2`). The wizard writes through the same
writer as `kerghan configure`, so every rule of
[Files and the shared writer](files.md#files-and-the-shared-writer) applies.

### Questions

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
| 8 | Restart after update (ask / always / never) | `restart-on-update` | config |
| 8a + | Write logs to a host directory (true / false) | `file-logs` | config |
| 8b + | Log directory (only when `file-logs` is true) | `log-dir` | config |
| 9 + | Default user enabled (true / false) | `KERGHAN_DEFAULT_USER_ENABLED` | env |
| 10 + | Default user is admin (true / false) | `KERGHAN_DEFAULT_USER_ADMIN` | env |
| 11 | Default user username | `KERGHAN_DEFAULT_USER_USERNAME` | env |
| 12 | Default user email | `KERGHAN_DEFAULT_USER_EMAIL` | env |
| 13 | Default user password (keep / generate / type) | `KERGHAN_DEFAULT_USER_PASSWORD` | env |
| 14 + | Public URL | `FRONTEND_BASE_URL` | env |

- **`bind` after `auto-login`.** When `bind` has no line in `config`, its bracketed default is
  the one derived from the auto-login answer (`127.0.0.1` when on, `0.0.0.0` when off).
- **Skipping the default user.** When automatic login ends up off **and**
  `KERGHAN_DEFAULT_USER_ENABLED` is `false` (its answer with `--advanced`, its current value
  otherwise), nothing uses the default user: questions 10–13 are skipped. There is no conflict
  check between the two: automatic login implies an enabled default user (see
  [Default user: configuration](../../modules/auth/default-user/configuration.md#configuration)).
- **Restart after update.** Asked as `Restart after update (ask/always/never) [ask]` (or the
  current value); not a boolean key, so `y` / `n` are not translated. See
  [Client update: wizard](../client-update.md#kerghan-wizard).
- **Public URL.** Asked as `Public URL [http://<host>:<port>, derived from bind and port]` (the
  [advertised URL](../client.md#advertised-url) of the bind and port answers, so `<host>` is
  `127.0.0.1` for the default bind and for `0.0.0.0`) when `kerghan.env` has no
  `FRONTEND_BASE_URL`, or with its current value. Enter keeps the current value; nothing is
  written when it was never set.
- **Never asked:** `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY` (see
  [Changing the secrets](security.md#changing-the-secrets)), the client-managed pair, and custom env
  variables. Those are handled by `kerghan configure` only.

### Prompts

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
  writes nothing: the key stays unset, so a later change of the default still reaches it. An env
  key with no line shows `not set`, and one from a bare `KEY` line shows `(from environment)`.
- **An invalid answer re-asks** the same question, after the validator's message on stderr (the
  `valid_*` validators for config keys, the known env key rules of [Values](files.md#values)). An empty
  answer is never invalid: it is Enter.
- **An invalid current value** ([Existing content](files.md#existing-content) case 4) is shown as invalid
  and the default is offered instead: `Port [3000] (current value 'abc' is invalid):`. Enter then
  writes the default, which fixes the line.
- **Booleans** accept `true` / `false` (and `y` / `n`, written as `true` / `false`).

#### Password

- **(k)eep** (the default): no change.
- **(g)enerate:** a new password from the same generator as `up` (48 hex characters). It is never
  printed; after the write the wizard says the new password is in `~/.kerghan/kerghan.env`.
- **(t)ype:** asked with hidden input, twice; a mismatch says so and asks both again; a password
  shorter than 8 characters is re-asked.

When `kerghan.env` has no password (a file from an older client, or no file yet), `keep` is not
offered and the default is `(g)enerate`.

### Starting state

Checked before the first question; any failure exits `1` and asks nothing:

- **No TTY.** Without a terminal on stdin the wizard fails with an error pointing to
  `kerghan configure` for scripted changes.
- **No `kerghan.env` with a data volume** ([Missing files](files.md#missing-files) case 3): the restore /
  `kerghan reset` hint, plus a pointer to `kerghan configure` for config-only changes.
- **A `config` line without `=`**: the line number and a request to fix it by hand.

With no `kerghan.env` and no data volume, the env questions offer the values a new file gets
(username `admin`, email `admin@kerghan.local`, a generated password); the write creates the file
as `up` does and applies the answers ([Missing files](files.md#missing-files) case 2).

The TTY check is a single helper, `is_tty` (stdin is a terminal), also used by `configure`'s
`KEY=-` and `--force` confirmation. Tests drive the wizard through stdin with the test-only
override `KERGHAN_ASSUME_TTY=true`, which makes that helper answer "terminal"; it is not listed
in the usage or the user docs.

### Summary and confirmation

Nothing is written while the questions run: the answers stay in memory until the confirmation.
After the last question the wizard prints the [change list](files.md#change-list) (secrets as
`<KEY>: changed`, see [Masking](security.md#masking)) and asks:

```
port: 3000 (default) -> 3002
auto-login: true (default) -> false
KERGHAN_DEFAULT_USER_EMAIL: admin@kerghan.local -> me@example.com
Write these changes? [Y/n]
```

- **`Y` / Enter:** writes everything (all or nothing, see [Writing](files.md#writing)), then prints the
  apply hint and any [cross-key warning](security.md#cross-key-warnings).
- **`n`:** prints `Nothing written.` and exits `0`.
- **No change at all:** prints `Nothing changed.` and exits `0` without asking.

### Abort

- **Ctrl-C** at any point before the write: nothing is written, exit `130`.
- **End of input** before the confirmation: nothing is written, an error says the input ended,
  exit `1`.
- **A running instance** needs no special handling: the wizard never touches it, and the apply
  hint says how to apply the change.

### Required tests

Covered by `standalone/test/wizard.bats`, driven through stdin with `KERGHAN_ASSUME_TTY=true`
unless stated:

- Without `KERGHAN_ASSUME_TTY` and with piped stdin: exit `1` pointing to `kerghan configure`, no
  question printed. An unknown option exits `2`.
- Without `--advanced`, questions 1, 2, 6, 7, 8, 11, 12, 13 in that order; with it, all sixteen (`file-logs` and `log-dir` are advanced-only; `log-dir` is asked only when the `file-logs` answer is true).
- Enter on every question with no `config` writes nothing and prints `Nothing changed.`.
- Port `3002` + confirm writes `port=3002`, prints the change list and the `kerghan up` hint.
- The `bind` default follows the auto-login answer; Enter on it writes no `bind` line.
- Auto-login `false` with `KERGHAN_DEFAULT_USER_ENABLED=false` skips the default user
  questions; auto-login `true` asks them.
- An invalid port re-asks; an invalid `runtime` line is shown invalid with the default offered,
  and Enter writes the default.
- Password: `g` writes 48 hex characters, never prints them, and says where they are; `t` with
  two matching answers writes it; a mismatch and a 7-character password re-ask; with no
  password in `kerghan.env`, `keep` is not offered. The summary shows
  `KERGHAN_DEFAULT_USER_PASSWORD: changed`.
- `--advanced` public URL: Enter with no `FRONTEND_BASE_URL` writes nothing; an answer writes it.
- `n` prints `Nothing written.`, exits `0`, both files byte for byte unchanged. End of input
  after question 2 writes nothing and exits `1`.
- No `kerghan.env`, no volume: created as `up` does with the answers applied; with a volume:
  exit `1` before the first question.
- The secrets are never asked; no `vault` call.

