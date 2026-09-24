# Plan: Refactor: Replace static-only client classes ApiClient, AdminClient and AccountsClient with object modules

Issue: [227-refactor-replace-static-only-client-classes-apiclient-adminclient-and-accountsclient-with-object-modules.md](../../issues/227-refactor-replace-static-only-client-classes-apiclient-adminclient-and-accountsclient-with-object-modules.md)

## Overview
Convert the three static-only HTTP client classes in `frontend/assets/js/client/` into plain
exported object modules (same names, same methods), move `ApiClient`'s private static methods
to module-level functions, and drop the now-obsolete PMD exclusions from `.codacy.yml`.

See [frontend.md](frontend.md) for the full plan.
