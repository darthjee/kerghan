# Issue: Refactor: Match routes without a dynamic RegExp

## Description
`Route` (`frontend/assets/js/utils/routing/Route.js`) builds a `RegExp` from a template string in its constructor, which Codacy reports as the only Error-level finding in the repository.

## Problem
Codacy flags `frontend/assets/js/utils/routing/Route.js:31` twice: `security-node/non-literal-reg-expr` (Error) and `security/detect-non-literal-regexp` (High).

The pattern is in practice safe — it is assembled only from escaped static segments and a bounded `(?<name>[^/]+)` group — and the line already carries an `eslint-disable-next-line` explaining that. Codacy does not honour inline disables, so the finding stays open no matter how the comment is worded.

## Expected Behavior
`Route` matches paths and extracts params with identical results to today (`matches(path)`, `params(path)`, `page`, including the optional trailing slash and `:param` capture), without constructing a `RegExp` from a non-literal string. The public API of `Route` is unchanged, and so therefore are `Router.register`, `Router.resolve`, `Router.extractParams` and `HashRouteResolver`.

Every route currently registered in `HashRouteResolver` keeps resolving as today, including the root route `'/'`, which `getPage()` also uses as the fallback for an empty hash.

## Solution
Replace the regex with segment-wise matching:

- In the constructor, split the pattern on `/` once and store the segments, **stripping one trailing empty segment**, so that the root pattern `'/'` becomes `['']`. Without this it would never match the path `'/'`.
- In `matches`/`params`, split the incoming path the same way, strip one trailing empty segment (this provides the optional trailing slash), and require equal segment counts.
- Compare static segments by strict equality (no escaping needed), and collect `:name` segments into a params object. A param segment must be non-empty, matching today's `[^/]+` semantics.
- `params` returns `{}` when the path does not match, as today.
- Drop `#escapeRegex`, the `#regex` field and the now-obsolete `eslint-disable` comment.

Known, acceptable divergence: the old regex for `'/'` (`^//?$`) also matched `'//'`, and the segment version will not. `Router.resolve` falls back to `'home'` when nothing matches, so the resolved page is the same either way.

Tests: keep the existing `RouteSpec` cases unchanged and add cases for:

- trailing slash (static and parameterized routes);
- the root route `'/'`;
- an empty param segment (e.g. `/games/`, `/games//`);
- extra and missing segments;
- a static segment containing regex-special characters (e.g. `.`), which must match literally.

## Benefits
Clears the repository's only Error finding, removes a dynamic-RegExp construction from the router, and drops a suppression comment Codacy ignores anyway.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
