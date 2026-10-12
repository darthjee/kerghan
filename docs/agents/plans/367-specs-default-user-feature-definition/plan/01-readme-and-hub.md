# README and hub registration

Create `docs/agents/specs/default-user/README.md`, mirroring the precedent `docs/agents/specs/standalone/README.md` (`git show 782a47b`):

- **Intro.** These are temporary feature specs for Epic #366, following the [specs hub](../../specs.md). While the folder exists it is the source of truth: #366's body is no longer maintained, and a sub-issue that changes a decision updates the spec in the same PR.
- **Overview and purpose.**
  - An environment-configured default user, created or synchronized at boot.
  - Optional always-on authentication through automatic login in `status.json`.
  - Aimed mainly at the standalone distribution, but also available online behind guards.
- **Product decision.** Epic #366. Re-discussing it is out of scope for the sub-issues.
- **Scope.**
  - In scope: the six implementation areas.
  - Out of scope:
    - frontend changes (no logout hiding, no automatic-login indicator in the UI);
    - more than one default user;
    - removing a previously created default user;
    - changing the demo-user seed migration;
    - turning the feature on in any production deployment.
- **Sub-issues and order.** #367 → (#374, #375, #368) → #369 → #370 → #371 → #372 → #373, with each file mapped to its implementing sub-issue.
- **Open items.** #374 (blocked-edit contract), #375 (`status.json` contract), and the client-IP risk owned by #371.
- **Note.** The variables live only here until #373 folds them into `environment-variables.md`. Do not "fix" this early.
- **Index** linking every other file.

In `docs/agents/specs.md`, replace the `none` line under "Active specs" with an entry linking `specs/default-user/README.md` and naming Epic #366. Keep the "When no feature is in progress…" sentence.

## Files to Change
- `docs/agents/specs/default-user/README.md`: new.
- `docs/agents/specs.md`: register the active spec.
