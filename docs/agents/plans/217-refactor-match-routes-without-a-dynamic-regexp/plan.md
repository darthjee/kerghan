# Plan: Refactor: Match routes without a dynamic RegExp

Issue: [217-refactor-match-routes-without-a-dynamic-regexp.md](../../issues/217-refactor-match-routes-without-a-dynamic-regexp.md)

## Overview
Replace `Route`'s dynamically built `RegExp` with segment-wise matching, preserving `matches`/`params`/`page` behavior for every registered route (including `'/'`), and extend `RouteSpec` to pin down the edge cases. Frontend-only.

See [frontend.md](frontend.md) for the full plan.
