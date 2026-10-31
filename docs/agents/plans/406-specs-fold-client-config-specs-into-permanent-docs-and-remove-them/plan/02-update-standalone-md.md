# Link it from standalone.md

In `docs/agents/standalone.md`:

- Add `configure` and `wizard` to the command block under "The `kerghan` client", matching the
  synopsis in `standalone/bin/kerghan`'s `usage()`.
- Add a short subsection (next to `update-env`, e.g. `#### configure and wizard`, or a
  `### Changing settings` under the client section): a few lines on what each command does,
  that both are write-only and print the apply hint, then a link to
  [client-config.md](standalone/client-config.md) for the full rules.
- Under "Configuration (`~/.kerghan/`)", say that both files can be edited by hand or through
  `kerghan configure` / `kerghan wizard`.
- In "Testing", mention that the client bats suite also covers `configure` and `wizard` (see the
  sub-doc's "Required tests").

## Files to Change
- `docs/agents/standalone.md` — command list, summary section with link, configuration and
  testing pointers.
