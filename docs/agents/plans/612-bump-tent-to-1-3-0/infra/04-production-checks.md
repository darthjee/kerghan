# Production pre-merge checks

Verify the three production compatibility checks from the issue's Backward compatibility section and record them, with the rollback path, in the PR description (contract 7). A failing check blocks the merge; do not work around it silently.

1. **Host PHP.** Read Tent 1.3.0's minimum PHP version (its `composer.json` `require.php`, or its Dockerfile's PHP base) from `darthjee/tent:1.3.0` (e.g. `docker run --rm darthjee/tent:1.3.0 cat /var/www/html/composer.json`). The host's PHP version cannot be read from CI; record the Tent minimum and ask the user, in the PR, to confirm the host's PHP — the issue makes a too-old host a blocker tracked as a separate host task.
2. **Image layout and tooling.** In `darthjee/tent:1.3.0` confirm `bash`, `ssh`, `rsync` are on `PATH` and `/var/www/html/` holds the full runtime including `vendor/` (compare with `1.0.3`'s top-level listing). In `darthjee/tent-test:1.3.0` confirm `/var/www/html/extension/` is the extension mount point and `vendor/bin/phpunit` / `vendor/bin/phpcs` exist.
3. **Host-only state.** Diff Tent's configuration API between 1.0.3 and 1.3.0 for what `proxy/prod_configuration/` uses (`Configuration::buildRule`, handler and middleware keys, `ProxyRequestHandler`), and check `proxy/prod_configuration/locals.php.sample` still lists every variable the 1.3.0 config needs (`$cacheFolder` etc.). If a new `locals.php` key is required, state the manual host step in the PR.
4. Record the documented expectations too: cache starts empty after the release swap (`./cache` inside the swapped directory — ask the user to confirm the real host `locals.php` keeps it there); rollback is re-running the previous tag's pipeline, whose CircleCI pins are still `1.0.3`.

## Files to Change

- None in the repository (PR description only), unless check 3 requires a `locals.php.sample` update.
