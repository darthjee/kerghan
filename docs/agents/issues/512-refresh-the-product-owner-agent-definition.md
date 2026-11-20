## Description

The read-only `product-owner` agent (`.claude/agents/product-owner.md`) describes an outdated product state, so its answers to "is this decided yet?" are wrong for several areas.

## Problem

Its "Current state: partial" section says repo selection is the only thing the backend persists, that there is no issue persistence by default, and that the tracked-repo data model is still open. Today the backend persists Integrations (encrypted GitHub credentials) and Repositories, the tracked-repo model is settled (see `docs/agents/product.md`'s Repositories section), and the Issues and Projects specs (`docs/agents/specs/issues/`) define persisted issues.

## Expected Behavior

The agent describes what is decided today (accounts, Default user, User approval, Integrations, Repositories, the Issues/Projects specs) and what is still open (label rules, org-wide tracking), pointing at where each decision lives.

## Solution

- Rewrite the "Current state" section against `docs/agents/product.md`, the module docs under `docs/agents/modules/` and `docs/agents/specs.md`.
- Add a "Product check" subsection to `.claude/agents/architect.md` so the agent is actually called before planning (see [Scope](#scope)).
- Remove the `product-owner` bullet from `docs/agents/product.md`'s "Once the data model is decided" list ("Update `.claude/agents/product-owner.md` to reference the real rules instead of 'flag by default.'"). This issue does what it asks for, and the agent never said "flag by default".
- Make keeping the map up to date part of the specs lifecycle (see [Keeping the map current](#keeping-the-map-current)).

### Scope

**In scope:**

1. **`.claude/agents/product-owner.md`**: rewrite it with the map of decided areas, the reading order and precedence rules, and the fixed answers (sections below). Also rewrite "When the architect invokes you", and update the frontmatter `description` to match the new triggers.
2. **`.claude/agents/architect.md`**: add a **"Product check"** subsection next to "Security and access-control review". Today nothing in `architect.md` calls `product-owner`, so without this the refreshed agent is never used.
   - **When:** before planning, if the issue introduces a new entity, endpoint, access rule or user-facing feature, or touches an area the map lists as Deferred or Still open.
   - **What to send:** the issue file.
   - **How to route its answers:**
     - **Decided** and **Decided in active spec**: proceed, citing the doc.
     - **Deferred** and **Undecided — needs product decision**: go to the user before planning.
     - **No documented rule**: a missing decision goes to the user, a missing doc to the architect.
     - **Doc conflict**: goes to the architect to fix the docs.
   - Unlike `security`/`data-access`, which run after implementation, the product check runs **before** planning.
3. **`docs/agents/product.md`**: remove the `product-owner` bullet (see [Keeping the map current](#keeping-the-map-current)).
4. **`docs/agents/specs.md`** (fold step) and **`docs/agents/specs/issues/model.md`** (fold list): the map-upkeep changes from [Keeping the map current](#keeping-the-map-current).

**Out of scope:**

- **`AGENTS.md`**: it's the user's own file, and its agent list already names `product-owner`.
- **`docs/agents/folder-structure.md`**: its one-line description is still accurate.
- **Arcanum skills** (`plan-issue`, `auto-plan-issue`): they aren't part of this repo, and they reach the agent through `architect.md`.
- **`security` and `data-access` agents**: already refreshed in #505. Only the two shared answer labels have to keep the same wording.
- **The content of `product.md`** and the label-rules data model.
- **A Definition of Done item in `contributing.md`** about adding map rows. This matches the out-of-scope note under [Keeping the map current](#keeping-the-map-current).

### Decided areas: a map, not a copy

The agent's "Current state" section becomes a short **map of decided areas** that links each area to the doc that defines it. It restates no rules. `docs/agents/product.md` (plus any active spec) stays the only source of the content, so the agent cannot drift from it. When a new area is decided, its epic adds one row to the map.

The map has one row per area that has its own section in `product.md`, plus the active spec. Smaller decided items go in the row of the area they belong to:

| Area | Where it is defined |
| --- | --- |
| Accounts and login (sessions, device authorization, GitHub handle, admin-only tools #40/#41) | `docs/agents/flow.md`, `docs/agents/modules/auth.md` and its pages |
| Default user (#366) | `docs/agents/modules/auth/default-user.md` |
| User approval (#389) | `docs/agents/modules/auth/user-approval.md` |
| Integrations (#295) | `docs/agents/modules/integrations.md` |
| Repositories (#444) | `docs/agents/modules/repositories.md` |
| Issues and Projects (active spec, #483) | `docs/agents/specs/issues.md` |
| Standalone distribution | `docs/agents/standalone.md` |
| Deferred (opt-in issue persistence, trend views, using integration credentials for issues) | `product.md`'s "Deferred" section |
| Still open (label rules, org-wide tracking, and everything downstream) | `product.md`'s "What's still open" section |

The table above lists the areas as they stand today. Whoever implements this should check it against `product.md`'s sections at that time.

### Keeping the map current

The rule that keeps the map in sync goes in the specs lifecycle, not in `product.md`:

- **`docs/agents/specs.md`, Lifecycle step 3** (the fold step): the feature's last sub-issue also updates the area's row in `.claude/agents/product-owner.md`'s map, so it points at the permanent docs instead of the spec folder.
- **`docs/agents/specs/issues/model.md`, "Statements to rewrite at fold time"**: add a row for `.claude/agents/product-owner.md` (the Issues and Projects row of the map). #492 then switches it from `specs/issues.md` to the permanent docs.
- **Out of scope:** areas decided without a spec (as Default user #366 and User approval #389 were) still depend on their author adding a row. That's acceptable as long as the agent also reads `product.md` in full: a missing row only makes the lookup slower, not wrong.

The other option was to reword the bullet into a standing "keep the map in sync" rule inside `product.md`. It was rejected because it would put a maintenance instruction in a product doc, under a heading about future work.

### Reading order and spec precedence

**Reading order** (always, before answering):

1. All of `docs/agents/product.md`, plus `docs/agents/flow.md`. These stay the main source. Reading `product.md` in full means a row missing from the map only slows the lookup and never produces a wrong answer.
2. The "Active specs" list in `docs/agents/specs.md`. The agent finds active specs there, not from its own map. The map's spec rows are only a shortcut, and `specs.md` is the authority.
3. For a question that touches an active spec's feature: that spec's index (e.g. `docs/agents/specs/issues.md`) and only the concern files the question is about (`model.md`, `api.md`, …), not the whole folder.

**Precedence:**

- **Within its feature's scope, an active spec overrides `product.md`**, as `specs.md` already says ("source of truth while the folder exists"). The agent answers from the spec and notes that `product.md` will be rewritten when the spec is folded in (e.g. the "Supersedes `product.md`" note and fold list in Issues and Projects).
- **Outside an active spec's scope, `product.md` alone applies.**
- **A conflict the spec doesn't acknowledge** (it neither names the `product.md` statement it overrides nor lists it to rewrite at fold time) is reported to the architect as a **doc conflict**. The agent never picks a winner on its own.
- **Completed specs are never read.** Their folders are gone, and the "Completed specs" list in `specs.md` points at the permanent docs.

The other option was to ignore specs and answer from `product.md` only. It was rejected because the agent would give wrong answers about issue persistence for as long as #483 is in progress.

### Answer vocabulary

Every answer uses one of these fixed answers. The two it shares with `data-access` use exactly the same wording, so the architect handles both agents' output the same way.

**Exact spelling:** `product-owner.md` writes every verdict lowercase and in quotes, following how `data-access.md` and `architect.md` spell the two shared ones today: "decided", "decided in active spec", "deferred", "undecided — needs product decision", "no documented rule" and "doc conflict". The table below capitalises them only for readability.

| Verdict | When | Answer must include |
| --- | --- | --- |
| **Decided** | Covered by `product.md`/`flow.md` or a module doc it links to | File and section that define it |
| **Decided in active spec** | Covered by an active spec, inside that spec's scope | Spec file and section, plus a note that `product.md` will be rewritten when the spec is folded in |
| **Deferred** | Listed in `product.md`'s "Deferred" section | The Deferred entry. Building it needs a product decision to bring it into scope first. |
| **Undecided — needs product decision** | Falls under `product.md`'s "What's still open" | The open item. The decision goes to the user. *(same wording as `data-access`)* |
| **No documented rule** | No doc covers it, and it isn't listed as open either | What was searched. A missing doc goes to the architect, a missing decision to the user. *(same wording as `data-access`)* |
| **Doc conflict** | Two docs disagree, and no spec acknowledges it (see [Reading order and spec precedence](#reading-order-and-spec-precedence)) | Both quotes with where they're from. Goes to the architect. |

**Answer format:**

- Every answer starts with the verdict, followed by the doc references.
- A question with several parts (e.g. new entity + new endpoint + access rule) gets one verdict per part.
- The agent never fills a gap with a default ruling.

The agent's "When the architect invokes you" section is rewritten around these verdicts. Its current line, "this depends on the still-open data-model decision", is replaced by **Undecided — needs product decision**, which now only applies to label rules, org-wide tracking and what depends on them.

The other option was a shared doc holding the verdicts for both agents. It was rejected because each agent file should stay self-contained and only two labels are shared. The wording is kept identical instead.

### Backward compatibility

1. **Nothing depends on the agent's output yet.** `architect.md` never calls it today, so the new answer format breaks no caller, and nothing needs migrating.
2. **Issues already planned are not re-checked.** The Product check runs before planning, so it applies only to issues planned after this lands. Existing plans in `docs/agents/plans/` and issues already in progress stay as they are.
3. **Autonomous runs** (`auto-plan-issue`, `auto-resolve-issue`, `auto-fix-all`) have no user to ask. The "Product check" subsection in `architect.md` says that when no user is available:
   - the architect writes the verdicts into the plan under a "Product check" heading;
   - the plan covers only the parts with a **Decided** or **Decided in active spec** verdict;
   - every other part is listed as an open blocker, not decided.

   How the run then stops or reports is the skill's own behaviour (arcanum, out of scope). The repo only makes sure an open product question is never decided silently.
4. **Cost and false triggers:** the check skips issues that only touch docs, infra, tooling or refactoring. It's a single read-only agent call before planning, so no extra review loop.
5. **Leftover cleanup:** the rewrite drops the agent's reference to Majora's product-owner agent. The "Majora shape" bullet in `product.md` stays, since it's about the future rewrite of `product.md`.

### Edge cases

The agent's definition covers these cases:

1. **A question that mixes decided and open parts** (e.g. "add a label-rule entity owned by a repository"): one verdict per part. Only the open parts go to the user, and the decided parts are answered directly.
2. **An active spec that is only partly built**: the agent rules on **decisions, not code**, and never reads the implementation. A decision in an active spec is **Decided in active spec** whether or not it has been built yet.
3. **An issue that contradicts a decided rule** (e.g. letting admins read integrations): the verdict is **Decided**, with the rule it contradicts quoted. It goes to the user, because changing a decided rule needs a product decision (the same as `data-access`'s "loosened access" check). This is a note added to the verdict, not a new verdict.
4. **A stale map row** (its target doc was moved or split): the agent falls back to the links in `product.md`, answers normally, and adds a `Notes:` entry ("agent definition stale: map row X"). The architect already treats these notes as follow-ups that don't block anything.
5. **A carve-out between Deferred and an active spec** (e.g. opt-in issue persistence stays Deferred, while Issues and Projects persists Kerghan's own issues): the spec's explicit carve-out decides, as in the precedence rule.
6. **Two active specs that disagree**: **Doc conflict**, sent to the architect.
7. **A question that isn't about the product** (which library to use, how to structure a migration): no verdict. The answer is "not a product question", sent back to the architect.

### Testing strategy

This is a docs-only change and there's no harness for testing agents, so it's verified with three manual checks. Their results go in the PR description.

**1. Sample questions with expected verdicts.** Ask the refreshed agent each question and attach its answers to the PR:

| # | Question | Expected verdict |
| --- | --- | --- |
| 1 | Add an endpoint that lists a user's repositories | **Decided**: `modules/repositories.md` |
| 2 | Persist Kerghan issues linked to GitHub issues | **Decided in active spec**: `specs/issues/model.md`, with the fold note |
| 3 | Add a label-rule entity | **Undecided — needs product decision** |
| 4 | Store fetched GitHub issues for trend charts | **Deferred**: opt-in issue persistence, kept separate from the spec's carve-out |
| 5 | Let admins read users' integrations | **Decided**, contradicts → user |
| 6 | Add a GitHub webhook receiver | **Decided** ("no GitHub webhooks"), contradicts → user |
| 7 | A label rule owned by a repository | Two verdicts: Repositories **Decided**, label rules **Undecided** |
| 8 | Which library to use for date formatting | **Not a product question** |
| 9 | A per-user dashboard theme preference *(only if the implementer confirms no doc covers it)* | **No documented rule** |

**Doc conflict** is not tested, because testing it would mean planting a fake conflicting doc.

**2. Map links resolve.** Every path in the map exists in the PR branch: an `ls` of each, with the output pasted in the PR.

**3. Shared wording is identical.** A case-sensitive `grep` showing that "undecided — needs product decision" and "no documented rule" (lowercase, exactly as `data-access.md` spells them) appear in both `data-access.md` and `product-owner.md`.

A CI check (a script that validates the map's links and the shared labels) was considered and rejected. It's more tooling than this needs, the map is short, and the agent already reports a stale row when it's used (edge case 4).

## Benefits

Pre-planning product checks reflect the actual product, matching the security/data-access agent refresh in #505.
