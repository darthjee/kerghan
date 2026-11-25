# Plan: Standalone: document HTTPS for LAN access and hint on plain-HTTP non-loopback binds

Issue: [603-standalone-document-https-for-lan-access-and-hint-on-plain-http-non-loopback-binds.md](../../issues/603-standalone-document-https-for-lan-access-and-hint-on-plain-http-non-loopback-binds.md)

## Overview

No plain-HTTP LAN opt-in. The standalone client gains a plain-HTTP hint on `kerghan up` (whenever
it passes `KERGHAN_COOKIE_SECURE=loopback`) and an auto-login-behind-a-proxy warning on `up` and
`configure`; a new user-facing page `docs/agents/standalone/https.md` documents a Caddy TLS recipe
with its security guidance. No backend, config-key or `kerghan.env` change. All work is in the
`standalone` agent's scope, followed by a `security` review.

See [standalone.md](standalone.md) for the full plan.
