# Inner stack and verification scripts

1. **Pass the variable through.** In `standalone/vault/docker-compose.yml`, add
   `KERGHAN_COOKIE_SECURE` to the `kerghan` service's optional pass-through list (name only), next
   to `FRONTEND_BASE_URL`, so the backend receives it.
2. **Report it in the verification scripts.** `standalone/scripts/verify_client_ip.sh` already
   prints the container's auto-login variables (`grep -E '^KERGHAN_DEFAULT_USER_(...)='`), and the
   `e2e` mode documented in `docs/agents/standalone/inner-stack.md` reports the image, published
   address, runtime and auto-login variables. Add `KERGHAN_COOKIE_SECURE` to those reports, so a
   manual run shows the cookie mode.
   - No change to their pass/fail criteria. The e2e check posts `/auth/status.json` without cookies,
     so it isn't affected.

## Files to Change

- `standalone/vault/docker-compose.yml`: the pass-through entry.
- `standalone/scripts/verify_client_ip.sh` (and the e2e helper if it is a separate script under
  `standalone/scripts/`): report the variable.
