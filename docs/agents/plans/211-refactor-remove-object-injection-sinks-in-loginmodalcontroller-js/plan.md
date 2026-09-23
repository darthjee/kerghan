# Plan: Refactor: Remove object-injection sinks in LoginModalController.js

Issue: [211-refactor-remove-object-injection-sinks-in-loginmodalcontroller-js.md](../../issues/211-refactor-remove-object-injection-sinks-in-loginmodalcontroller-js.md)

## Overview
Replace the two bracket-access lookups in `LoginModalController` with `Map` lookups so Codacy stops flagging `security/detect-object-injection`, with no behavior change. Frontend-only.

See [frontend.md](frontend.md) for the full plan.
