# Plan: Refactor: Address PHPMD StaticAccess warnings in CacheControlMiddlewareTest and DomainHashTest

Issue: [233-refactor-address-phpmd-staticaccess-warnings-in-cachecontrolmiddlewaretest-and-domainhashtest.md](../../issues/233-refactor-address-phpmd-staticaccess-warnings-in-cachecontrolmiddlewaretest-and-domainhashtest.md)

## Overview
Move four `@SuppressWarnings(PHPMD.StaticAccess)` annotations from inline `//` comments (which PHPMD ignores) into their test methods' docblocks. Test-only change in `proxy/extension/tests`.

See [proxy.md](proxy.md) for the full plan.
