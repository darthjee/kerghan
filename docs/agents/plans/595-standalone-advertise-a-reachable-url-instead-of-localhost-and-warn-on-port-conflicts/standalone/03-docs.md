# Document the check and the macOS AirPlay clash

Describe the new behavior, and the macOS caveat that started it.

- `docs/agents/standalone/client.md`:
  - Under `### Other behavior`, extend **Port in use** to describe the pre-start check:
    - when it runs (only before a new container is created; never when the instance is already running);
    - the warning lines and the AirPlay hint;
    - the skips (no `lsof`/`ss`, a remote `DOCKER_HOST`);
    - that it never fails `up`.
  - Document `port_listeners` briefly as the shared helper that `kerghan diagnose` (#597) reuses: its output format and its exit `2` "skipped" status.
- `docs/agents/standalone/release-and-caveats.md`: a new **macOS AirPlay Receiver** caveat under `## Caveats`. It covers:
  - ControlCenter listens on `*:5000` and `*:7000` (IPv4 and IPv6) while AirPlay Receiver is on.
  - Docker's `127.0.0.1` bind still succeeds, and `localhost` (`::1` first) reaches AirPlay, which answers `403` with `Server: AirTunes`.
  - How to tell: `curl -si http://127.0.0.1:<port>` shows `Server: Apache` from Kerghan's Tent.
  - The fixes: pick another port, or turn off System Settings → General → AirDrop & Handoff → AirPlay Receiver.
  - A pointer to #598 for the advertised-URL change.
- `README.md`: if it has a standalone troubleshooting or quick-start note near `kerghan up`, add one line pointing to the caveat. Otherwise leave it unchanged.

Keep `docs/agents/standalone/config-files.md`'s statement that the user-facing URL stays `http://localhost:<port>`. It's still true until #598.

## Files to Change

- `docs/agents/standalone/client.md`: the port-in-use behavior and the `port_listeners` contract.
- `docs/agents/standalone/release-and-caveats.md`: the macOS AirPlay caveat.
- `README.md`: optional one-line pointer.
