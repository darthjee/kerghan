# `update --finish` (new client)

Implement `cmd_update_finish`, step 5 of command.md, in this order:

1. `load_config`.
2. Validate the handoff env: `KERGHAN_UPDATE_FROM` used only when it matches
   `[A-Za-z0-9._-]{1,64}` (`case` patterns + `${#v}`, bash 3.2 safe); downgrade detected only
   when it is `x.y.z` and newer than `KERGHAN_VERSION` (contracts.md rule 5 — never drop).
   `KERGHAN_UPDATE_RESTART` other than `always`/`never` (non-empty) → the `ignoring
   KERGHAN_UPDATE_RESTART=...` warning and treated as unset.
3. Env step: `kerghan.env` missing and no data volume → skip silently; missing with the volume
   → the warning + `update-env`'s restore/`reset` hint and mark the restart as skipped;
   otherwise `add_missing_env_keys` (no apply line; nothing printed when nothing is missing).
4. Previous image = `running_image` (empty when not running); record the container ID
   (`docker inspect -f '{{.Id}}' vault-kerghan`) when running.
5. `image-tag` override set → the `still overrides the pinned image tag` warning +
   `configure --unset image-tag` hint.
6. `docker pull` the image `up` would run (`image_ref` with the config/default variant and the
   override), in the foreground with progress. Failure → `could not pull ...; kerghan was updated
   to <v>, the instance was not restarted` + `update --force` / `kerghan up` hint, exit 1.
7. Restart decision, first matching row of command.md's table: downgrade → no restart (downgrade
   hint); env missing with volume → no restart; not running → `run 'kerghan up' to start` hint;
   running image equals pulled image → no prompt/restart (`down && up` hint only if keys were
   added); `KERGHAN_UPDATE_RESTART` then `restart-on-update` = `always` → restart, `never` → the
   not-restarted hint; `ask`/unset on a TTY → `Restart Kerghan now? [Y/n] ` on stderr
   (`Y`/`yes`/Enter restart; anything else or EOF does not); `ask` without a TTY → not-restarted
   hint.
   Restart = `set +e; ( set -e; cmd_up ); rc=$?; set -e` (not `( cmd_up ) || rc=$?`). Non-zero
   → `the restart failed; kerghan was updated to <v>`, exit `$rc`. Same container ID after a
   restart and keys were added → the `down && up` hint.
8. Result line on stdout (`updated X -> Y` / `<v> reinstalled` / `<v> is installed`), then on a
   downgrade the instance-state hint, otherwise the `docker image rm <previous>` cleanup hint
   (restarted vs "after 'kerghan up'" form) only when the previous image is known and differs
   from the pulled one. Exit 0.

`update --finish` run by hand works the same (no download, no install, `is installed` result).

## Files to Change
- `standalone/bin/kerghan` — new `cmd_update_finish` and its small helpers (e.g.
  `update_restart_decision`, `update_result_hints`).
