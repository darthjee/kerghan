# Write config.md

Create `docs/agents/specs/standalone/config.md`:

- `~/.kerghan/` layout: `config` (client settings) and `kerghan.env` (secrets and backend variables,
  mode 600).
- `config` format: flat `key=value`, `#` comments, like Vault's `.vaultrc`. Keys: `port` (default
  `3000`), `variant` (`online` | `offline`, default `online`), `runtime` (`auto` | `sysbox` |
  `privileged`, default `auto`), `stop-timeout` (default `60`), `image-tag` (optional override of
  the pinned tag).
- Precedence: CLI flag → `config` → built-in default.
- Malformed lines and unknown keys: a clear error naming the line (decide error vs warning per case
  and record it).
- Format decision and rejected alternatives: JSON (needs `jq`), YAML (needs `yq`, e.g. in a
  container); reconsider only if nesting is needed.
- **Required tests:** precedence for each key; defaults when the file is absent; malformed input;
  `--offline` overriding `variant=online` and vice versa.

## Files to Change
- `docs/agents/specs/standalone/config.md` — new.
