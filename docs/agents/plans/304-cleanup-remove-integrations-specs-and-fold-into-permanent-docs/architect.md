# Architect Plan: Cleanup: remove integrations specs and fold into permanent docs

Main plan: [plan.md](plan.md)

## Shared contracts

Create the files and headings listed in [plan.md's shared contracts](plan.md#shared-contracts)
exactly as named. The backend and frontend comments cite those anchors.

## Steps

- [01 — Write the integrations module docs](architect/01-module-docs.md)
- [02 — Write the integrations routes doc](architect/02-routes-doc.md)
- [03 — Update product, flow, overview, env-var docs and boundaries](architect/03-update-permanent-docs.md)
- [04 — Delete the spec and verify](architect/04-delete-spec-and-verify.md)

## CI Checks

- Markdown: markdownlint through Codacy (`.codacy.yml`, `.markdownlint.json`). Keep lines
  within the configured length and use consistent heading levels.

## Notes

- Write decisions, not history. Drop "Required tests", "Manual smoke check (#30x)", "Which
  issue reads what", "Files" and every "temporary spec" note.
- Keep the content factual to what was built. When the spec and the code disagree, the code
  wins, and the doc is fixed to match it.
