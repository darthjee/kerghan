# Plan: Refactor: FormFieldsHelper and AppHelper: remove object-injection sinks and replace static-only classes

Issue: [214-refactor-formfieldshelper-and-apphelper-remove-object-injection-sinks-and-replace-static-only-classes.md](../../issues/214-refactor-formfieldshelper-and-apphelper-remove-object-injection-sinks-and-replace-static-only-classes.md)

## Overview
This plan converts `AppHelper` and `FormFieldsHelper` from static-only classes to the object-module helper shape introduced in #212. It replaces their variable-key object reads with `Map` lookups and `Object.hasOwn`-guarded reads, and removes the lint suppressions they no longer need. The public API and rendered output stay the same.

See [frontend.md](frontend.md) for the full plan.
