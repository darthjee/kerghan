# Security static spec and docs

- **Security static spec:** extend `securityStaticSpec.js` to `issues/link/**` and `issues/sync/**`: no `dangerouslySetInnerHTML` or `innerHTML`, and no `localStorage` or `sessionStorage` writes (S1, S4). Add an assertion that `savedIssueSignal.js` uses no storage API.
- **Docs:** add a "Linking and sync (#562)" subsection to `docs/agents/architecture/frontend.md` under the Projects module. It covers the link panel and presenter, the import and attach modals, `BoundedRereadController`, the focus re-read throttle, the saved-issue signal and the project-header refresh.
- **Spec index:** align the #562 row of the implementation table in `docs/agents/specs/issues.md` with the issue's *Builds against* list (add `ui.md#required-tests`, `ui/screens-and-flows.md#lists`, `ui/decisions.md`, `api/github-link.md`, `edge-cases.md`, `security.md` and `testing.md`).
- Run `docker-compose run kerghan_fe yarn coverage` and `docker-compose run kerghan_fe yarn lint`.

## Files to Change
- `frontend/specs/assets/js/components/resources/projects/securityStaticSpec.js`
- `docs/agents/architecture/frontend.md`
- `docs/agents/specs/issues.md`: the #562 row
