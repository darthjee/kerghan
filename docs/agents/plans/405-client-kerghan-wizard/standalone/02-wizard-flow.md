# `cmd_wizard` flow and questions

Add `cmd_wizard` after `cmd_configure` and register `wizard) cmd_wizard ${@+"$@"} ;;` in
`main`.

1. **Arguments:** only `--advanced` is accepted. Anything else goes to `usage_error` (exit `2`).
2. **Starting state**, checked before the first question; each check exits `1` and asks
   nothing:
   - `is_tty` fails: error pointing to `kerghan configure` for scripted changes.
   - `read_settings`. If `CR_NOEQ_LINES` is non-empty: the line number plus a hint to fix it
     by hand.
   - `kerghan.env` is missing and `volume_exists`: the restore / `kerghan reset` hint (same
     wording as `batch_validate`), plus a pointer to `kerghan configure` for config-only
     changes.
3. **Questions**, in the table order of wizard.md (1–13). Questions 3, 4, 5, 8, 9 and 13 are
   only asked with `--advanced`, plus the invalid-line exception in the plan Notes.
   - Each config question gets its bracket text and "current value invalid" state from
     `setting_lookup`.
   - `bind` is asked after `auto-login`. When `bind` has no line, its bracket default is
     derived from the auto-login *answer*: `127.0.0.1, derived from auto-login` or
     `0.0.0.0, derived from auto-login`.
   - Skip rule: when the effective auto-login (the answer, or the current value) is `false` and
     `KERGHAN_DEFAULT_USER_ENABLED` is `false` (its answer with `--advanced`, its current value
     otherwise), skip questions 9–12.
   - With no `kerghan.env` (and no volume), the env questions offer what a new file gets:
     `admin`, `admin@kerghan.local`, password default `g`. Pressing Enter on username or email
     writes nothing, because the file creation in `batch_apply` provides those values.
   - Public URL: when `FRONTEND_BASE_URL` is unset, the prompt is
     `Public URL [http://localhost:<port answer>, derived from port]`; otherwise it shows the
     current value. Enter writes nothing.
   - Never ask for `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY`, the client-managed pair or
     custom env keys.
4. **Recording an answer:** an answer becomes `batch_add set <key> <value>` only when it
   differs from Enter. Exception: Enter on an invalid current value adds a `set` of the
   default. Track the generated password flag for the summary.

## Files to Change
- `standalone/bin/kerghan` — `cmd_wizard`, the dispatch entry in `main`.
