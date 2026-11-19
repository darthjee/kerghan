# Create the six pages and slim the hub
Move, do not rewrite. For each page, cut the line range from `docs/agents/modules/repositories.md` and paste it into the new file under a one-line intro and an H1 title, with a back-link "Part of the [Repositories module](../repositories.md)" (same shape as `sync.md` and `edge-cases.md`). Keep every moved heading text unchanged so anchors survive; promote heading levels by one (`##` section title becomes the page `#`, `###` become `##`, `####` become `###`) — anchors do not depend on level.

Ranges (original line numbers):
- `data-model.md`: 45–287
- `security.md`: 288–462
- `frontend.md`: 463–610
- `testing.md`: 611–766
- `testing-coverage.md`: 767–908 (give it an H1 "Testing coverage"; its first subsection is Concurrency and races)
- `required-tests.md`: 909–1057

Then trim `repositories.md` to lines 1–44 plus a rewritten `## Index` (replace lines 1058–1067): one row per page under `repositories/` (`data-model`, `security`, `frontend`, `testing`, `testing-coverage`, `required-tests`, and the existing `sync` and `edge-cases`), each with a one-line "read this when…" description, followed by the existing rows for Routes, GitHub service and GitHub handle. Add a 1–2 paragraph summary under the title if the Overview does not already read as one (it should stay short).

## Files to Change
- `docs/agents/modules/repositories.md` — slimmed to hub, new index.
- `docs/agents/modules/repositories/data-model.md` — new.
- `docs/agents/modules/repositories/security.md` — new.
- `docs/agents/modules/repositories/frontend.md` — new.
- `docs/agents/modules/repositories/testing.md` — new.
- `docs/agents/modules/repositories/testing-coverage.md` — new.
- `docs/agents/modules/repositories/required-tests.md` — new.
