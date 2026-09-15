# Plan: Refactor: simplify escapeHtml() in render-template.ts to a single-pass replacement

Issue: [101-complexity--escapehtml---in-render-template-ts-exceeds-the-50-line-method-limit.md](../../issues/101-complexity--escapehtml---in-render-template-ts-exceeds-the-50-line-method-limit.md)

## Overview

The Codacy finding backing this issue (71 lines, 50-line limit) does not reproduce against the
current `escapeHtml()` (8 lines). This plan proceeds as the agreed voluntary clarity refactor
instead: replace the five chained `.replace()` calls in `escapeHtml()` with a single regex pass
over a static character→entity lookup table, removing the implicit "`&` must be escaped first"
ordering dependency.

See [backend.md](backend.md) for the full plan.
