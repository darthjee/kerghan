# Plan: Security: ReDoS-prone dynamic RegExp construction in Route.js

Issue: [95-security--redos-prone-dynamic-regexp-construction-in-route-js.md](../issues/95-security--redos-prone-dynamic-regexp-construction-in-route-js.md)

## Overview

Codacy's Error-severity `security-node/non-literal-reg-expr` finding at
`frontend/assets/js/utils/routing/Route.js:27` is a static-analysis false positive: every caller
passes a static, hardcoded route pattern, and `Route` already escapes literal segments and bounds
`:param` segments to `[^/]+` before building the `RegExp`. Resolve it by following this project's
existing convention for confirmed Codacy false positives, with no functional/runtime change.

See [frontend.md](frontend.md) for the full plan.
