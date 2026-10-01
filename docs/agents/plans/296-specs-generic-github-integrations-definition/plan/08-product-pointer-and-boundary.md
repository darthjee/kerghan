# Product pointer and agent-boundary rewording

Make the decision visible to the product-owner, security and data-access agents while #297–#303
are built:

- `docs/agents/product.md` — add a one-line "in progress" pointer (e.g. in "Deferred" where
  private-repo GitHub tokens are listed, and/or "What's already decided") stating that per-user
  GitHub integrations are being built under #295 and are defined in
  `specs/integrations/README.md`. #304 replaces it with the real definitions; do not rewrite
  the rest of the file.
- `CLAUDE.md` — reword the "Never add GitHub credential storage…" boundary to: GitHub
  credentials may be stored **only** as integrations as defined in
  `docs/agents/specs/integrations/` (encrypted per `security.md`); any other credential storage
  still requires an explicit product decision. Issue fetching remains unauthenticated for now.
- `AGENTS.md` — update the mirrored sentence (the "Kerghan has a lightweight per-user
  account/login…" bullet) consistently with `CLAUDE.md`.
- Also check `.claude/agents/*.md` (architect, security, data-access, product-owner, backend)
  for the same "no GitHub credential storage" rule; if any repeats it verbatim, align the
  wording so no agent blocks #300. Keep changes minimal — #304 finalizes the wording.

## Files to Change

- `docs/agents/product.md` — "in progress" pointer to the integrations specs.
- `CLAUDE.md` — reworded credential-storage boundary.
- `AGENTS.md` — mirrored boundary wording.
- `.claude/agents/*.md` — only if they restate the old boundary verbatim.
