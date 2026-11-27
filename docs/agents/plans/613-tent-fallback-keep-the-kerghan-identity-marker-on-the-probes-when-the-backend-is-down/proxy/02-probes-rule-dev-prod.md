# Add rules/probes.php to dev and prod

Write `rules/probes.php` with exactly the shape in plan.md contract 2, and require it from `configure.php` between `rules/frontend.php` and `rules/backend.php` in both the dev and prod trees. The two files, and the standalone copy the standalone agent writes, must be **byte-identical**. Write it once and copy it.

The docblock (the same in every copy) covers:

- the purpose (#613), and why the rule sits before `backend.php`: that rule matches every `*.json`, so a later rule never sees the probes;
- why only `GET`/`HEAD` match: other methods fall through to `backend.php`;
- why `'cache' => false` and no cache middlewares: probes are never cached, and `default_proxy` caches `2xx` by default;
- the timeouts, and the invariant `timeout` < `probe_http --max-time` in `standalone/bin/kerghan`, plus a note to change both together;
- that the file reads only `$backendHost` (so `ProbeFallbackTest` can load it on its own), and that the three copies must stay byte-identical.

Add a one-line comment next to the new `require_once` in each `configure.php`: "probes before backend: backend.php matches every *.json".

## Files to Change

- `proxy/dev_configuration/rules/probes.php`: new.
- `proxy/prod_configuration/rules/probes.php`: new, byte-identical to dev.
- `proxy/dev_configuration/configure.php`: require `rules/probes.php` between frontend and backend.
- `proxy/prod_configuration/configure.php`: same.
