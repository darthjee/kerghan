# Update projects.md and api.md

Replace v1's blanket refusal of a repository change with the rule "allowed only while the project has zero links".

- `projects.md`, "Changing a project later": a repository can be attached to a project with none; changing it or detaching it is allowed only while the project has zero links and is refused with `409` carrying the link count otherwise; same checks as creation; it never syncs. Say the project row is locked first so a concurrent link creation cannot race it (pointing at [github-link.md](github-link.md#same-repository-rule-and-repository-changes)).
- `projects.md`: remove the "Changing or detaching a repository while no links exist" item from "Not decided"; in "Required tests", replace "changing or detaching a repository is refused with `409`" with the zero-links rule (allowed at zero links, refused with the count otherwise, and the race with a link creation); keep the edge-case table consistent (add a pointer to E62 only if a row would be misread).
- `api.md`: update the `409` line (a change or detach of a repository is refused only while links exist) and any required test or open question that says it is always refused. State that the link count travels in the refusal (exact payload and code stay with #489), and that an unlink without confirmation while unsent changes exist and an attach without confirmation when local values differ are `409` refusals whose codes #489 names.

## Files to Change
- `docs/agents/specs/issues/projects.md` — the repository change rule, "Not decided" and "Required tests".
- `docs/agents/specs/issues/api.md` — the `409` line and the link, unlink and repository-change refusals.
