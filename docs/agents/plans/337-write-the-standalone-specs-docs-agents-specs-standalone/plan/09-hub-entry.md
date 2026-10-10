# Register the feature in the specs hub

In `docs/agents/specs.md`, replace "none" under **Active specs** with:

> - **Standalone distribution** — [specs/standalone/](specs/standalone/README.md): ship Kerghan as
>   `darthjee/kerghan` (Render) and `darthjee/kerghan-standalone` (Vault). Epic #336.

Do not touch `AGENTS.md`, `CLAUDE.md` or any `.claude/agents/` file: they link only to the hub.
Also check `docs/agents/external.md`'s Vault entry still reads correctly (it says Vault is not used
yet; leave the wording change to #347, but it may point at the hub entry if useful).

## Files to Change
- `docs/agents/specs.md` — Active specs entry.
