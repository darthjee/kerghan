# Add the Product check to architect.md

Add a `### Product check` subsection to `.claude/agents/architect.md`, placed right before `### Security and access-control review` (around line 70). It runs before planning, so it reads in pipeline order.

Content:

- **When**: before planning an issue that introduces a new entity, endpoint, access rule or user-facing feature, or touches an area `product-owner`'s map lists as deferred or still open. Skip issues that only touch docs, infra, tooling or refactoring.
- **What to send**: the issue file.
- **Routing the verdicts**:
  - "decided" and "decided in active spec": proceed, citing the doc in the plan.
  - "deferred" and "undecided — needs product decision": go to the user before planning.
  - "no documented rule": a missing decision goes to the user, a missing doc to the architect.
  - "doc conflict": the architect fixes the docs.
  - A "decided" verdict carrying a contradiction note (the issue changes a decided rule) goes to the user.
  - `Notes:` entries ("agent definition stale") don't block anything and may call for follow-up, as for `security`/`data-access`.
- **No user available** (autonomous runs): write the verdicts into the plan under a `## Product check` heading. Plan only the parts with a "decided" or "decided in active spec" verdict, and list every other part as an open blocker. Never decide an open product question silently.
- Contrast it with `security`/`data-access`, which run after implementation.

Spell the verdicts exactly as in step 01 (lowercase, quoted).

## Files to Change

- `.claude/agents/architect.md`: new `### Product check` subsection.
