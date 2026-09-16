# Plan: BestPractice: proxy PHP tests use static access to concrete classes, hindering mocking (11 occurrences)

Issue: [104-bestpractice--proxy-php-tests-use-static-access-to-concrete-classes--hindering-mocking--11-occurrences.md](../issues/104-bestpractice--proxy-php-tests-use-static-access-to-concrete-classes--hindering-mocking--11-occurrences.md)

## Overview
Suppress the Codacy `PHPMD.StaticAccess` finding at its 11 flagged sites in `proxy/extension/tests/`, since each site is a legitimate static call (a pure utility function, or a static factory method the Tent middleware framework itself dictates) rather than an accidental coupling — no production code changes.

See [proxy.md](proxy.md) for the full plan.
