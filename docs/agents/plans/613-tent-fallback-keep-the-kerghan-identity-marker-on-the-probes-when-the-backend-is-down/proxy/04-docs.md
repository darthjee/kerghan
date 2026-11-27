# Proxy docs

Document the probe rule wherever Tent rules and the probes are already described.

- `docs/agents/architecture/proxy.md`: add `rules/probes.php` to the rule list or loading order (frontend, probes, backend, redirects), with its matchers, timeouts, `cache => false`, the fallback middleware, the byte-identity requirement across three trees, and the timeout invariant.
- `docs/agents/architecture/backend/request-pipeline.md`, "Health probes": add what the proxy answers when the backend is down, with both pinned bodies and their `502`/`504` statuses. Note `status: "down"` and `checks.*: "unknown"` as values only the proxy emits, next to the backend's `ok | degraded | error` and `up | down`. Note that `version` is never synthesized.
- `docs/agents/architecture/caching.md`: in the operational-endpoints note, add that the probes are routed by `probes.php` with `cache => false` and no cache middleware, and that the synthesized fallback is `Cache-Control: no-store`.
- `.claude/agents/proxy.md`, "Rule loading order": add `rules/probes.php` as step 2 (before `backend.php`), with one line on why.

## Files to Change

- `docs/agents/architecture/proxy.md`
- `docs/agents/architecture/backend/request-pipeline.md`
- `docs/agents/architecture/caching.md`
- `.claude/agents/proxy.md`
