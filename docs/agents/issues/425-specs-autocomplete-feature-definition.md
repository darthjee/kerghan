# Issue: Specs: autocomplete feature definition

## Description

First sub-issue of the shell autocomplete Epic (#424). Write the feature specs for bash tab completion of the `kerghan` client, following the lifecycle in `docs/agents/specs.md` (precedents: client config #403, client update #415).

Feature summary (the full context and every decision are in #424):

- **Shell:** bash only. zsh and fish are separate, later Epics; the design must not block them (`kerghan completion <shell>` takes the shell as an argument).
- **Completed:** command names, each command's flags, `configure` keys (config keys and the static `DEFAULT_ENV_KEYS` names), and the values of keys and flags with a fixed set (`variant`, `runtime`, `auto-login`, `restart-on-update`). Free-form values get no suggestions.
- **Not completed:** `update` versions, `compose`/`logs` passthrough, the `vault` CLI, anything that needs Docker, Vault, network or file reads.
- **Delivery:** a new `kerghan completion bash` command that prints the script (for `eval "$(kerghan completion bash)"`), and `install.sh` installing that output into the user-level bash-completion directory.

### Scope

In scope:

- The spec folder `docs/agents/specs/auto-complete/` (layout below) and its "Active specs" entry in `docs/agents/specs.md`.
- Every decision from #424's sections (Scope, `install.sh` completion setup, Edge cases 1–19, Backward compatibility 1–9, Performance & security 1–9), each written into the file it belongs to.
- The **shape** of the `completion` command: `kerghan completion <shell>`, `bash` as the only supported shell, the script on stdout, errors on stderr, non-zero exit on error.
- **Rules** in `completion.md`: what is completed per command, and edge cases 1–17 from #424 as behaviour. The exhaustive per-position table is #427's.
- **"Required tests" sections** listing the behaviours that must be tested, as a bullet list, one per rule. #428 adds the harness and concrete cases.
- **Open markers** for the decisions later sub-issues settle (see [Open markers](#open-markers)).

Out of scope:

- Any code (`standalone/bin/kerghan`, `standalone/install.sh`, bats tests).
- The decisions left to the spec-enhancement sub-issues, which this issue only marks as open: the source of the word lists (#426), the exact per-position completion table and **every verbatim string** (the `completion` usage line, error messages, exit codes, installer `hint:`/`warning:` text) (#427), and the testing harness and full test coverage (#428).
- The permanent docs (`docs/agents/standalone.md`, `README.md`, the `install.sh` header), including lifting "shell completion" from `standalone.md`'s out-of-scope list: all folded in by #431.
- The zsh and fish Epics.

Owner: the architect writes the specs. The standalone agent reviews, in the same PR, the parts that touch the client's and the installer's existing behaviour (the installer's `update` contract, bash 3.2 compatibility, the `configure` syntax).

If writing the specs shows that a decision in #424 conflicts with the client's current behaviour, adjust the decision in the spec and call it out in the PR description.

### Open markers

Where a decision belongs to a later sub-issue, the spec holds a short placeholder in the file it belongs to, e.g.:

> **Open — settled by #426:** source of the word lists (generated from the client's constants vs. hand-written + sync test).

- `completion.md`: the word-list source → #426; the exact per-position table → #427.
- `command.md` and `install.md`: exact messages and exit codes, and the `completion` usage line → #427.
- Every "Required tests" section: the harness and full coverage → #428.

Each later sub-issue removes its own markers. The fold sub-issue (#431) checks that none remain.

### Related sub-issues of #424

#426 (word-list source) → #427 (completion matrix and messages) → #428 (testing strategy) → #429 (client `completion bash`) → #430 (installer setup) → #431 (fold and remove).

## Problem

Completion spans a client command, the installer and future shells, and it creates contracts (the `completion bash` command, the `_kerghan` function, `KERGHAN_COMPLETION`, the file path) that can't change once released. Without one agreed definition, the implementation sub-issues would make their own decisions.

## Expected Behavior

- These files exist under `docs/agents/specs/auto-complete/`; each one except `README.md` ends with a "Required tests" section:

  ```
  docs/agents/specs/auto-complete/
  ├── README.md       overview, scope, decisions summary (#424), index
  ├── command.md      `kerghan completion <shell>`: shape, stdout/stderr, error cases (exact text → #427)
  ├── completion.md   completion rules per command (flags, keys, values) + edge cases 1–17
  ├── install.md      install.sh setup: path, static content, hint, non-fatal, opt-out, downgrade
  ├── contracts.md    stable contracts: `completion bash`, `_kerghan`, KERGHAN_COMPLETION, file path
  └── security.md     performance & security rules
  ```

- Where each #424 decision goes:

  | File | Holds | #424 source |
  |------|-------|-------------|
  | `README.md` | Overview, purpose, product decision (#424), scope in/out, zsh/fish follow-up Epics, decisions summary, index, list of open markers | Description, Scope, Related Epics |
  | `command.md` | `kerghan completion <shell>`: shape, `bash` only, stdout/stderr split, no side effects, no-shell / unsupported-shell error case | Scope (delivery); Edge cases 18–19; Perf 2 |
  | `completion.md` | What is completed per command (commands, flags, `configure` keys incl. `DEFAULT_ENV_KEYS`, fixed values), what is never completed, edge cases 1–17 as behaviour, bash 3.2 compatibility | Scope (what gets completed); Edge cases 1–17; Perf 1 |
  | `install.md` | `install.sh` setup: target path, static content from the just-installed client, temp + `mv -f`, hint without `bash-completion`, never fatal, `KERGHAN_COMPLETION=false`, overwrite, downgrade leftover, no uninstall | `install.sh` completion setup; Backward compatibility 2, 3, 8 |
  | `contracts.md` | Stable contracts: `completion bash` accepted forever, `_kerghan`, `KERGHAN_COMPLETION` in the installer interface, the completion file path, the installer's `update` contract kept; the sync rule | Backward compatibility 4–7, 9 |
  | `security.md` | Performance & security: pure-bash TAB, no subprocess/file reads, fixed-text output, shell hygiene, no secrets, installer write safety, exact binary, `eval` cost; pointer to bash 3.2 in `completion.md` | Performance & security 1–9 |

- **Sync rule:** stated in `contracts.md`. Its enforcement is settled by #426; #431 folds it into the permanent docs.
- **Who reads what:** #429 (client) reads `command.md`, `completion.md`, `contracts.md`, `security.md`; #430 (installer) reads `install.md`, `contracts.md`, `security.md`; #431 reads all.
- **Precedent:** follow `docs/agents/standalone/client-update.md` for tone and structure.
- There is no separate `docs/agents/specs/auto-complete.md` file: `docs/agents/specs.md` is the hub and `README.md` is the feature's entry point.
- `docs/agents/specs.md` lists the feature under "Active specs".
- Every decision deferred to #426, #427 or #428 appears as an open marker in the right file.

## Benefits

- One definition the client and installer sub-issues build against.
- The stable contracts are fixed before the release that ships them.
