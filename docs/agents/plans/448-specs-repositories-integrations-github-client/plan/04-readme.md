# README: markers, decisions summary, sub-issues row, #452 checklist

- **Open markers:** remove every row owned by #448.
- **Decisions summary:** add the #448 decisions in the existing style (one line each: service,
  single client, endpoints + `sort=created`, token cache, usable rule, error mapping + Add walk,
  helpers in `core/`, `integration.deleted` event + safety net, tracker + two thresholds).
- **Sub-issues:** the #448 row also lists `api.md`.
- **Product changes folded by #452:** add `modules/integrations/github-app.md` — installation
  tokens are cached in memory for repo calls instead of minted per use — and
  `modules/integrations.md` — the module exports `IntegrationsGithubService` and emits
  `integration.deleted`.

## Files to Change
- `docs/agents/specs/repos/README.md` — markers, decisions summary, sub-issues row, #452 checklist.
