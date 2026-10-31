# Create the client-config sub-doc

Create `docs/agents/standalone/client-config.md` holding every lasting decision of the spec,
written as a permanent reference (present tense, no "this feature adds"):

1. **Overview and scope**, from the spec `README.md`: the two commands, the shared writer, the
   two files and their key sets, routing by key case (no `--env`), write-only behavior (the only
   Docker call is the read-only volume check), what stays out of scope (client-managed
   `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` / `KERGHAN_DEFAULT_USER_ALLOWED_IPS`, no `--json`,
   no secrets in the wizard).
2. **Exit codes and streams**: the table and stream rules from the spec `README.md`, including
   "a refusal writes nothing".
3. **Files and the shared writer**, from `files.md`: the two files, known env keys, key routing,
   missing files, existing content (invalid, duplicate and commented-out lines, unknown keys),
   values, writing (permissions, atomic writes, symlinks), change list and apply hint.
4. **`kerghan configure`**, from `configure.md`: usage, list, single read, write, `KEY=-`,
   `--unset KEY`, `--show-secrets` and `--force`, refused keys.
5. **`kerghan wizard`**, from `wizard.md`: usage, questions and order, prompts and bracket
   defaults, the password prompt, starting state, summary and confirmation, abort, no-TTY failure.
6. **Security**, from `security.md`: masking, inline secrets and the `=-` hint, changing the
   secrets (`--force`), cross-key warnings, password change effects, file safety, Docker
   footprint.

Each of sections 3–6 ends with a condensed `### Required tests` list taken from the matching
spec file, and points at the bats file that covers it (`standalone/test/configure_files.bats`,
`configure.bats`, `wizard.bats`, `configure_security.bats`). Before folding a rule, check it
against `standalone/bin/kerghan`. If the code differs from the spec, document what the code
does and mention the difference in the PR description.

Start the file with a one-line back-link to [Standalone Distribution](../standalone.md) and a
short index of its sections.

## Files to Change
- `docs/agents/standalone/client-config.md` — new; the folded spec content.
