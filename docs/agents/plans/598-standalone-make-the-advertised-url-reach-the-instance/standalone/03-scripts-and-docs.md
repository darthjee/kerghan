# CI scripts, config example and docs

Update every place that prints or documents the standalone `localhost` URL. Out of scope: the
dev stack URLs in `README.md` (`localhost:3000/3030/3010`) and other `localhost` mentions under
`docs/agents` (navi, vault, backend env, OAuth/GitHub App config).

1. **CI scripts**: `standalone/scripts/smoke_test.sh` (`BASE_URL="http://localhost:$SMOKE_PORT"`)
   and `standalone/scripts/verify_client_ip.sh` (default `BASE_URL` and its header comment)
   default to `http://127.0.0.1:<port>`, so CI exercises the advertised URL.
2. **`standalone/config.example`**: the `port` comment reads `(http://127.0.0.1:<port> with the
   default bind)`.
3. **`README.md`**: the `kerghan up` example (`starts Kerghan on http://127.0.0.1:3000`).
4. **Docs** (`docs/agents/`):
   - `standalone/client.md`: synopsis, the `vault up ... [-e FRONTEND_BASE_URL=...]` line, the
     derived-URL paragraph (now `advertised_url` of bind and port), the LAN hint text, and the
     conflict warning text (`such as localhost:<port>`). Document the per-bind table from the
     issue.
   - `standalone/config-files.md`: reverse the recorded decision "the user-facing URL stays
     `http://localhost:<port>` with any bind": the client advertises the published address
     (`127.0.0.1` for `0.0.0.0`), since #598.
   - `standalone/client-config/files.md`, `standalone/client-config/wizard.md` (Public URL
     default `derived from bind and port`), `standalone/client-update/command.md` (sample output).
   - `standalone/inner-stack.md`: the derived `FRONTEND_BASE_URL` / `OriginGuard` paragraph and
     the `e2e` `BASE_URL` default.
   - `standalone/https.md`: both `localhost` and `127.0.0.1` stay valid on the host; "points to
     `http://localhost:<port>`" becomes the advertised URL.
   - `standalone/release-and-caveats.md`: the AirPlay caveat notes that since #598 the client
     advertises `127.0.0.1`, so only a hand-typed `localhost` hits it. Lines about both hosts
     keeping the login and about different cookie hosts stay.
   - `environment-variables/standalone.md`: the derived `FRONTEND_BASE_URL` default.
   - `standalone/client-diagnose.md`: the advertised-URL check prints `[ok] advertised URL is the
     published address` instead of probing twice when they are equal; exit 6 remains for when
     they differ.

## Files to Change

- `standalone/scripts/smoke_test.sh`, `standalone/scripts/verify_client_ip.sh` — default URL.
- `standalone/config.example` — `port` comment.
- `README.md` — `kerghan up` example.
- `docs/agents/standalone/client.md`, `config-files.md`, `client-config/files.md`,
  `client-config/wizard.md`, `client-update/command.md`, `inner-stack.md`, `https.md`,
  `release-and-caveats.md`, `client-diagnose.md` — as above.
- `docs/agents/environment-variables/standalone.md` — derived default.
