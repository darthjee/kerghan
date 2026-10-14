# Confirm the effective client IP and update the spec

Close the spec's open risk with a real measurement.

- On a real Docker host (and Docker Desktop for macOS if available), build or pull a `kerghan-standalone` image that contains this branch's backend, run `kerghan up` with the new client, and open it from the host browser (or `curl -c` to `/status.json` through the published port).
- Find which client IP the backend resolves. For example, temporarily log `ip` in the automatic-login path, or check the `X-Forwarded-For` value Tent sets (`SetClientIpMiddleware` overwrites it with Tent's `REMOTE_ADDR`), read with `KERGHAN_TRUSTED_PROXY_HOPS` at its default of 1. Confirm the default hop count resolves Tent's value and needs no override. If it does need one, pass `KERGHAN_TRUSTED_PROXY_HOPS` from the client and add it to the compose pass-through.
- If the observed IP is always within one narrow range (e.g. only `172.16.0.0/12`) across the hosts you tested, narrow `DEFAULT_USER_ALLOWED_IPS` and its tests. Otherwise keep the full private-range list.
- Confirm that with the default `bind=127.0.0.1` the port is not reachable from another machine on the LAN, and that `status.json` reports the `admin` user from the host.
- Update `docs/agents/specs/default-user/standalone.md`: replace "Open risk: effective client IP" with the finding (path, observed IP or range per host type, hop setting, final allowlist value, and why `bind` is the real guard). Also record the decisions taken in the issue: the client-managed variables override `kerghan.env`, a changed bind recreates the instance, and the unsafe-combination warning. Add these to its "Required tests" list.

## Files to Change
- `docs/agents/specs/default-user/standalone.md` — finding and decisions.
- `standalone/bin/kerghan` and `standalone/vault/docker-compose.yml` — only if the allowlist is narrowed or a hop setting is needed.
