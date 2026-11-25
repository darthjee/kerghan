# Docs, README and `config.example`

Update every place that lists settings, inner services or preloaded images:

## `standalone/config.example`

Add `file-logs` and `log-dir` with comments (values, default `~/.kerghan/logs`, absolute or `~/`
only, no `:` or spaces). Add both keys to the "A changed port, variant, … recreates the instance"
paragraph at the top.

## Standalone docs

- `docs/agents/standalone/config-files.md`: the format sample (:20-29), the key table (:32-41:
  Values, Default, Overridden by, Passed to Vault as `-e KERGHAN_FILE_LOGS` / `-v …:/vault/logs`),
  and the bullets.
- `docs/agents/standalone/client.md`:
  - the `vault up` mapping block (:39-48): add the `-e` triple and the `-v`;
  - the `up` recreate rules (:206-229);
  - `reset` and `down` keep the logs (:264-266);
  - the completion fixed values (:187).
- `docs/agents/standalone/client-config.md:23`, `client-config/files.md` (:9 and the apply-hint
  table at :150-157), `client-config/configure.md` (the sample listing) and
  `client-config/wizard.md` (the question table: advanced, `log-dir` only when `file-logs` is
  true).
- `docs/agents/standalone/client-completion/behavior.md`: the keys (:40), fixed values (:49) and
  free-form list (:125).
- `docs/agents/standalone/inner-stack.md`:
  - add a `logs` row to the service table (:12-21), with its role, the socket, `init`, restart and
    the env;
  - add the bounded `json-file` logging;
  - add `docker-cli.tar` to the online/offline image lists (:123-135);
  - describe the collector: one file per service, 10 MB × 5, timestamps, idle when off, reattach
    with `--since`.
- `docs/agents/environment-variables/standalone.md`: the flow (:11-17), and rows for
  `KERGHAN_FILE_LOGS` and `KERGHAN_HOST_UID`/`GID` as client-managed and `logs`-service only (the
  cookie row at :26 is the precedent).
- `docs/agents/standalone/release-and-caveats.md`, caveats (:36+):
  - log files survive `down` and `reset`; delete them with `rm -r ~/.kerghan/logs`;
  - on Docker Desktop for macOS, a custom `log-dir` must be inside a shared file path;
  - the outer Vault container's own log is unbounded until darthjee/vault#81, and users can set
    `log-opts` in Docker's `daemon.json`.
  - Testing (:109-120): the new smoke checks.
- `docs/agents/specs.md`: the "Standalone distribution" and "Client config" rows (:65, :68), if
  their summaries list keys or services.

## README.md

- The config key list (:177).
- A short "Logs" note: where the files are, `file-logs=false` to turn them off, how to delete them.
- The caveats around :190-200.

## Files to Change

- `standalone/config.example`
- `docs/agents/standalone/config-files.md`, `client.md`, `client-config.md`,
  `client-config/files.md`, `client-config/configure.md`, `client-config/wizard.md`,
  `client-completion/behavior.md`, `inner-stack.md`, `release-and-caveats.md`
- `docs/agents/environment-variables/standalone.md`
- `docs/agents/specs.md` (if needed)
- `README.md`
