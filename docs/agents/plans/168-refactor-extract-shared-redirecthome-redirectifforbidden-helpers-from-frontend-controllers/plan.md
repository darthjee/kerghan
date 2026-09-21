# Plan: Refactor: extract shared redirectHome/redirectIfForbidden helpers from frontend controllers

Issue: [168-refactor-extract-shared-redirecthome-redirectifforbidden-helpers-from-frontend-controllers.md](../../issues/168-refactor-extract-shared-redirecthome-redirectifforbidden-helpers-from-frontend-controllers.md)

## Overview
Extract the duplicated "redirect home" guard/assignment and the "403 → redirect home" rule into a new `utils/routing/redirects.js` module and replace all seven copies. Pure frontend refactor with no behavior change.

See [frontend.md](frontend.md) for the full plan.
