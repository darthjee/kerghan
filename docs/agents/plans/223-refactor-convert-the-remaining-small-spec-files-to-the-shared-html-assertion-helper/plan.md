# Plan: Refactor: Convert the remaining small spec files to the shared HTML-assertion helper

Issue: [223-refactor-convert-the-remaining-small-spec-files-to-the-shared-html-assertion-helper.md](../../issues/223-refactor-convert-the-remaining-small-spec-files-to-the-shared-html-assertion-helper.md)

## Overview
Spec-only conversion of the last five specs that still use `renderToStaticMarkup` / HTML literals (`MyAccountHelperSpec`, `LoginModalSpec`, `ResetPasswordLandingSpec`, `ModalRedirectSpec`, `AppSpec`) to the shared `renderedOutput` helper. It adds an `isEmpty()` query to that helper for the two "renders nothing" cases. The whole change is owned by the `frontend` agent.

See [frontend.md](frontend.md) for the full plan.
