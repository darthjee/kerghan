# Lint and agent review

1. **Cross-file consistency pass** — confirm the same values appear everywhere: status names,
   error codes/HTTP statuses, env var names and defaults, key-id format, AAD composition, cooldown
   and cool-off defaults, the 7-day "expiring soon" window, and that `README.md` links every file
   and `specs.md` lists `integrations/`. Every relative link resolves.
2. **Markdown lint** — run markdownlint through Docker (never on the host), e.g.
   `docker run --rm -v "$PWD":/work -w /work davidanson/markdownlint-cli2 "docs/agents/specs.md" "docs/agents/specs/**/*.md" "docs/agents/product.md" "docs/agents/index.md" "docs/agents/summary.md" CLAUDE.md AGENTS.md`,
   and fix findings (fenced code blocks need a language, e.g. `text` for the tree).
3. **Agent review** — dispatch `product-owner`, `security` and `data-access` with the list of
   new/changed files; resolve every objection by editing the specs, then re-invoke the objecting
   agent until none remain open. Optionally ask `cache` to confirm the never-cache /
   `X-Skip-Cache` / no-Navi statements match `architecture/caching.md`.

## Files to Change

- Any file from steps 01–08 that needs fixes from lint or review.
