# Plan: Refactor: Convert AccountEditFormHelperSpec.js to the shared HTML-assertion helper

Issue: [220-refactor-convert-accounteditformhelperspec-js-to-the-shared-html-assertion-helper.md](../../issues/220-refactor-convert-accounteditformhelperspec-js-to-the-shared-html-assertion-helper.md)

## Overview
Add a `containsInOrder` query to the shared `renderedOutput` spec helper, then rewrite `AccountEditFormHelperSpec.js` on top of `renderedOutput` and the shared `itBehavesLikeAnAccountEditFormHelper` examples, removing its 20 `xss/no-mixed-html` findings. Spec-only change, owned by the frontend agent.

See [frontend.md](frontend.md) for the full plan.
