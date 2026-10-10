# Example config and spec updates

- Add `standalone/config.example`: every key commented out with its default, allowed values, the
  flag that overrides it, and a note that runtime/stop-timeout apply on the next container
  creation. Install it as `~/.kerghan/config`.
- Spec updates so the installer sub-issue ships it:
  - `docs/agents/specs/standalone/config.md` — the `image-tag` semantics (version part only,
    variant suffix appended, non-semver skips version compare), recreation only on image/port,
    `config.example`, which commands read the config, the "Passed to Vault as" mapping.
  - `docs/agents/specs/standalone/README.md` — add `standalone/config.example` to the file table
    (owner `standalone`, shipped as a release asset).
  - `docs/agents/specs/standalone/installer.md` — add `config.example` to the release assets.
  - `docs/agents/specs/standalone/client.md` — port hint wording and the `--runtime` /
    `--stop-timeout` arguments in the `vault` mapping.

## Files to Change
- `standalone/config.example` — new commented example.
- `docs/agents/specs/standalone/config.md` — decisions from #345.
- `docs/agents/specs/standalone/README.md` — file table entry.
- `docs/agents/specs/standalone/installer.md` — release asset entry.
- `docs/agents/specs/standalone/client.md` — vault mapping and hint.
