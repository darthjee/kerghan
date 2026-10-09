# Plan: Add a Content-Security-Policy

Issue: [331-add-a-content-security-policy.md](../../issues/331-add-a-content-security-policy.md)

## Overview
Have the Tent proxy send a Content-Security-Policy header on the HTML document (`/` and the OAuth/GitHub App callback landings), using the existing `SetResponseHeadersMiddleware`. Production gets a strict, enforced policy. The Vite dev server gets a looser one.

See [proxy.md](proxy.md) for the full plan.
