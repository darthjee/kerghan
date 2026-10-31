# Repoint code and test comments

Replace every comment link to `docs/agents/specs/client-config/...` with the matching anchor in
`docs/agents/standalone/client-config.md`. Only comments change; no behavior changes.

Then check that `usage()` in `standalone/bin/kerghan` matches the folded docs (synopsis, flags,
one-line descriptions). Fix the docs if they differ; change the usage text only if it is wrong
about the implemented behavior.

## Files to Change
- `standalone/bin/kerghan` — comments near the shared writer (~line 517) and the wizard
  (~line 1851).
- `standalone/test/configure.bats` — header comment.
- `standalone/test/configure_files.bats` — header comment.
- `standalone/test/configure_security.bats` — header comment.
- `standalone/test/wizard.bats` — header comment.
