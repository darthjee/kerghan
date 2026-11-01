# Feature README and Active specs entry

Create `docs/agents/specs/client-update/README.md`, the feature's entry point, in the same shape as the client config README (#403):

- **Title and intro:** "Temporary feature specs for the `kerghan update` client command and its `restart-on-update` setting." Product decision: #414. Lifecycle and conventions: link to `../../specs.md`.
- **Overview:** today, upgrading means re-running the installer and then `kerghan up`. Summarize what `update [VERSION]` does (resolve the version, install it through the release's installer, hand off to the new client, update the env, pull, restart according to the setting, show the cleanup hint).
- **Scope:** in scope and out of scope, taken from #414 (out of scope: automatic update checks, updating `vault`, checksum verification, image pruning, rollback, data migration beyond what `up` already does).
- **Behaviour decisions summary:** the no-op and `--force`; downgrade with a warning plus confirmation or `--yes`; client and image always updated together; no rollback; no restart when the instance is not running; the `image-tag` override kept with a warning.
- **Index:** one line per file (`command.md`, `versions.md`, `setting.md`, `contracts.md`, `security.md`), plus who reads what (#416 → `setting.md`; #417 → `command.md`, `versions.md`, `contracts.md`, `security.md`; #418 → all of them).

No "Required tests" section in the README.

Then, in `docs/agents/specs.md`, replace "none" under "Active specs" with an entry pointing at `specs/client-update/README.md` (feature name and product decision #414), following the format the hub used for earlier active entries.

## Files to Change
- `docs/agents/specs/client-update/README.md` — new: overview, scope, decisions summary, index.
- `docs/agents/specs.md` — "Active specs" lists Client update (#414).
