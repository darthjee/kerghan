# Update the diagnose docs

`docs/agents/standalone/client-diagnose.md` (around line 45) says Kerghan is identified by `GET /health.json` answering `200` with the body `{"status":"ok"}`. Rewrite that paragraph to cover:

- identification by `"app":"kerghan"` in the body, with the legacy `200 {"status":"ok"}` still accepted for older images;
- the displayed version (validated semver only);
- a `5xx` carrying the marker means "Kerghan, backend down" (exit 4), which becomes reachable once #613 ships the Tent fallback. Until then, a down backend still shows up as an empty `200`, reported as another service;
- `/ready.json` `degraded` (workers down) is reported without failing;
- update the exit-code table row for `4` if the wording needs "or the backend is down behind the proxy".

## Files to Change

- `docs/agents/standalone/client-diagnose.md` — identification, degraded and backend-down cases
