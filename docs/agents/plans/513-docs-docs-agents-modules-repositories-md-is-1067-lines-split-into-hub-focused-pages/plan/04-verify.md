# Verify
1. Line counts: `wc -l docs/agents/modules/repositories.md docs/agents/modules/repositories/{data-model,security,frontend,testing,testing-coverage,required-tests}.md` — each under 300 (hub, too).
2. Pure move: the concatenation of the six pages' bodies (minus the added intro/H1/back-link lines and the one-level heading promotion) equals original lines 45–1057 (`git show HEAD:docs/agents/modules/repositories.md`) apart from link rewrites.
3. Anchor coverage: every heading of the original file that existed (excluding `## Index`) still exists in exactly one page or the hub.
4. Link check: a small script resolves every relative `.md` link and `#anchor` (GitHub slug rules) in all files under `docs/` and `AGENTS.md`/`CLAUDE.md`/`.claude/agents`; no unresolved target that did not already fail before the change.
5. The hub index lists all eight pages in `repositories/` and links resolve.

## Files to Change
- None expected; fix whatever the checks flag in the files of steps 01–03.
