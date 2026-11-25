# Docs

1. **The HTTPS caveat in `docs/agents/standalone/release-and-caveats.md`.** Rewrite it:
   - On a loopback `bind` (the default `127.0.0.1`) the client drops `Secure` from the session
     cookies, so login works over plain HTTP in every browser, Safari included.
   - On a LAN bind (`0.0.0.0` or a LAN IP), cookies stay `Secure` and plain-HTTP login fails. This
     includes Safari on `127.0.0.1` of a `bind=0.0.0.0` instance. Use a TLS reverse proxy and an
     `https` `FRONTEND_BASE_URL`, which keeps `Secure`. Opt-in LAN support is tracked in #601.
   - `localhost` and `127.0.0.1` are different cookie hosts: logging in on one does not log in the
     other.
2. **`README.md`.** The "HTTPS: plain HTTP works only on `localhost`" bullet gets the same
   correction, in short form.
3. **`docs/agents/environment-variables/standalone.md`.** Document that the client always passes
   `KERGHAN_COOKIE_SECURE` (the rule and the values). It is client-managed, so `kerghan.env` must
   not set it.
4. **`docs/agents/standalone/client.md`:**
   - the `vault up` argument line now includes `-e KERGHAN_COOKIE_SECURE=…`;
   - the recreate triggers now include the cookie setting, with its two reasons;
   - the client-managed keys now include `KERGHAN_COOKIE_SECURE`.
5. **`docs/agents/standalone/inner-stack.md`:**
   - the pass-through list now includes the variable;
   - the e2e/verify reports now show it.
6. **The `client-config` pages.** Add `KERGHAN_COOKIE_SECURE` wherever they list the client-managed
   keys.

## Files to Change

- `docs/agents/standalone/release-and-caveats.md`
- `README.md`
- `docs/agents/environment-variables/standalone.md`
- `docs/agents/standalone/client.md`
- `docs/agents/standalone/inner-stack.md`
- `docs/agents/standalone/client-config/*.md` (wherever client-managed keys are listed)
