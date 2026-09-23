# Plan: Refactor: Convert LoginModalFormsHelperSpec.js to the shared HTML-assertion helper

Issue: [218-refactor-convert-loginmodalformshelperspec-js-to-the-shared-html-assertion-helper.md](../../issues/218-refactor-convert-loginmodalformshelperspec-js-to-the-shared-html-assertion-helper.md)

## Overview
Frontend-only, spec-only refactor. Add a `containsElement(tagName, text)` query to the shared `renderedOutput` spec helper, then convert `LoginModalFormsHelperSpec.js` to it so no rendered markup and no `<tag` literal reaches any call. This clears the file's 44 Codacy `xss/no-mixed-html` findings. It closes with the one-off real-rule verification gate from #216.

See [frontend.md](frontend.md) for the full plan.
