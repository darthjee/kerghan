# Plan: Refactor: Clean up SetClientIpMiddleware PHPMD findings (superglobal, unused parameter, static access, else)

Issue: [232-refactor-clean-up-setclientipmiddleware-phpmd-findings-superglobal-unused-parameter-static-access-else.md](../../issues/232-refactor-clean-up-setclientipmiddleware-phpmd-findings-superglobal-unused-parameter-static-access-else.md)

## Overview
Clear five PHPMD findings in `SetClientIpMiddleware` and its test by confining `$_SERVER` access to the `build()` factory, converting ineffective `//` suppression comments into docblock `@SuppressWarnings` annotations, and removing an `else` from the test's cleanup.

See [proxy.md](proxy.md) for the full plan.
