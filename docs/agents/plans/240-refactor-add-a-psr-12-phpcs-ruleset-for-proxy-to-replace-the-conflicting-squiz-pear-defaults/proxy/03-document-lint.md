# Document ownership and the lint command

Extend the proxy agent's documented scope to cover the root `phpcs.xml` and the `proxy_lint` service, and document the new PSR-12 check wherever proxy checks are listed.

- `.claude/agents/proxy.md`:
  - Under "Your scope", add the root `phpcs.xml` (the PSR-12 ruleset for `proxy/`, also read by Codacy).
  - Note that the proxy agent owns the `proxy_lint` service, while infra still makes the edits in `docker-compose.yml`.
  - Add `docker-compose run --rm proxy_lint` to the command examples and to "Local development checks", and state that proxy PHP follows PSR-12.
- `.claude/scripts/check_proxy.sh`: add `docker-compose run --rm proxy_lint` to the proxy checks.
- `docs/agents/contributing.md`: in the `proxy/` row of the checks table (line 55), add `docker-compose run --rm proxy_lint` next to `docker-compose run proxy_tests`, and note that it is local only.
- `docs/agents/architecture/proxy.md`: add a short note that proxy PHP follows PSR-12, enforced by the root `phpcs.xml` (Codacy and `proxy_lint`).

## Files to Change

- `.claude/agents/proxy.md`: scope and lint command.
- `.claude/scripts/check_proxy.sh`: run `proxy_lint`.
- `docs/agents/contributing.md`: proxy checks row.
- `docs/agents/architecture/proxy.md`: PSR-12 note.
