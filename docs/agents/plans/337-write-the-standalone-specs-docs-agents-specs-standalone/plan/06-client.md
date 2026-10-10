# Write client.md

Create `docs/agents/specs/standalone/client.md`:

- Purpose and platforms: thin bash wrapper around the `vault` CLI; Linux and macOS, bash 3.2+.
- Commands: `up [--offline] [-p PORT] [-f]`, `down`, `logs [-f]`, `status`, `compose <args>`,
  `reset` (confirmation required; removes `vault-kerghan-data`), `version`, `help`.
- Mapping: `vault <cmd> --name kerghan --image darthjee/kerghan-standalone:<version>[-offline] --env-file ~/.kerghan/kerghan.env -p <port>:80`;
  container `vault-kerghan`, volume `vault-kerghan-data`; the image version is pinned in the script
  at release time; online and offline share instance and volume.
- Secrets: generate `KERGHAN_SECRET_KEY` and `KERGHAN_INTEGRATIONS_KEY` (`openssl rand -base64 32`)
  into `~/.kerghan/kerghan.env` (mode 600) on the first `up`; never regenerate when the file exists;
  docs tell users to back it up.
- Refusal: `up` refuses to start when `kerghan.env` is missing but `vault-kerghan-data` exists,
  with a hint to restore the file or run `kerghan reset`.
- `FRONTEND_BASE_URL=http://localhost:<port>` passed by default unless `kerghan.env` sets it.
- Upgrade: an older-image instance is recreated (`down`, then `up`), keeping the volume; migrations
  run at boot. Downgrade: warn when the CLI is older than the instance's image (unsupported).
- Port in use: surface Vault's error with a hint (`-p` or `port=` in `~/.kerghan/config`).
- One instance per host (fixed name). Out of scope: completion, backup command, `--name`.
- **Required tests:** argument building per command; secret generation and file mode; no
  regeneration; the refusal case; upgrade recreation; downgrade warning; `reset` asks before
  deleting; default `FRONTEND_BASE_URL` and its override.

## Files to Change
- `docs/agents/specs/standalone/client.md` — new.
