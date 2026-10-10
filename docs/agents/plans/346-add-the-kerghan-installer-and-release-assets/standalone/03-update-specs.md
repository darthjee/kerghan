# Update the standalone specs

Bring the epic's specs in line with the decisions taken on #346. Per the specs README, a
sub-issue that changes a decision updates the spec in the same PR.

- `installer.md`:
  - `KERGHAN_VERSION` default: "the version stamped in `install.sh` by
    `scripts/bump_version.sh`", not "latest release";
  - the Vault installer comes from
    `https://raw.githubusercontent.com/darthjee/vault/<VAULT_VERSION>/install.sh`, because
    darthjee/vault releases carry no assets;
  - assets table: drop `kerghan.env.example`, and `SHA256SUMS` covers the three files;
  - the CI job creates the release when it is missing and uploads with `--clobber`, using
    `GITHUB_TOKEN`;
  - verification: add `--ignore-missing` to the commands, for when only `install.sh` is
    downloaded.
- `variables.md` "Shipped documentation": drop `standalone/kerghan.env.example`. The
  `environment-variables.md` section written by #347 documents the pass-through variables.
- `README.md` (specs): drop the `standalone/kerghan.env.example` row from the files table.
- `.claude/agents/standalone.md`: drop the `standalone/kerghan.env.example` scope line, and say
  "env example" → "config example" in the description, if it is mentioned there.

## Files to Change

- `docs/agents/specs/standalone/installer.md` — version default, Vault source, assets,
  verification.
- `docs/agents/specs/standalone/variables.md` — no `kerghan.env.example`.
- `docs/agents/specs/standalone/README.md` — files table.
- `.claude/agents/standalone.md` — scope list and description.
