# Consistency sweep

Verify the specs agree after steps 01 to 04.

- `grep -n "#488" docs/agents/specs` — every remaining mention is history or a link, never an open item; no "(#488)" open questions remain.
- `grep -n "479" docs/agents/specs` — no "depends on" or "waits for" #479.
- `grep -n -i "paused\|approval event\|resume on approval\|resumes when" docs/agents/specs` — no approval-resume wording left (E24).
- Check every `sync.md#…` anchor used by the other files exists.
- Check `sync.md` "Required tests" covers each rule section, and `edge-cases.md` tier lists still name every row once.
- Confirm no code, migration or endpoint file is touched (`git diff --stat` shows only `docs/agents/specs/`).

## Files to Change
- Any of the files above, only to fix inconsistencies found by the sweep.
