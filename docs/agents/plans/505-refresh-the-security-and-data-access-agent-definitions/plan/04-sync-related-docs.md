# Sync the related docs

- **`docs/agents/contributing.md`**: add a Definition of Done bullet next to the bash-completion
  sync rule, with the issue's Maintenance rule: a PR that adds a project-wide security mechanism, a
  new kind of place where rules live, or a new review-trigger category updates the `security`
  surface summary, both agents' discovery rule, or `architect.md`'s trigger list in the same PR;
  features and modules that register their security docs in `docs/agents/specs.md` or a module
  `## Security` section need no agent change.
- **`docs/agents/product.md`**: in the "Once the data model is decided" list, drop `data-access.md`
  from the bullet that says to update `product-owner.md` and `data-access.md` "instead of flag by
  default" (`product-owner.md` stays, tracked by #512). Keep line 7's statement that `product.md` is
  where the agents check "is this decided yet?".
- **`docs/agents/specs/issues/security.md`**: reword the `## Review checklist` intro so it no longer
  says the generic agent definitions are stale or that the review prompt must point at this section
  — the agents now apply it through discovery; and drop the "refreshing the `security` and
  `data-access` agent definitions is #505" clause from `## Open questions`.

## Files to Change
- `docs/agents/contributing.md` — new Definition of Done bullet.
- `docs/agents/product.md` — reword the `data-access` part of the TODO bullet.
- `docs/agents/specs/issues/security.md` — reword the two #505 references.
