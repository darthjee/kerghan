# Update the root README
In `README.md` "Run Kerghan standalone":
- "Upgrade": `kerghan update` (optionally `kerghan update <VERSION>`), what it does in one or two sentences, and the `restart-on-update` setting.
- Add the first-upgrade note: clients 0.8.2 and older have no `update`; run the installer once by hand, then `kerghan up`, to reach the first version with `update`. From then on `kerghan update` works.
- Reword "Downgrades are not supported" to match the shipped behaviour.
- Link to `docs/agents/standalone/client-update.md` next to the existing `client-config.md` link, and add `restart-on-update` to the configuration summary if it lists keys.

## Files to Change
- `README.md` — upgrade section, first-upgrade note, links
