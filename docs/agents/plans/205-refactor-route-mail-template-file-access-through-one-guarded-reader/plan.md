# Plan: Refactor: Route mail template file access through one guarded reader

Issue: [205-refactor-route-mail-template-file-access-through-one-guarded-reader.md](../../issues/205-refactor-route-mail-template-file-access-through-one-guarded-reader.md)

## Overview

Centralize the eight scattered `existsSync`/`readFileSync`/`readdirSync` calls in
`backend/src/mail/template-registry.ts` behind one internal, type-guarded reader, so Codacy's
`security/detect-non-literal-fs-filename` and `xss/no-mixed-html` findings collapse to at most
one reviewed call site, with no observable change to registry output.

See [backend.md](backend.md) for the full plan.
