# Plan: BestPractice: proxy PHP tests access $_SERVER superglobal directly (8 occurrences)

Issue: [103-bestpractice--proxy-php-tests-access---server-superglobal-directly--8-occurrences.md](../../issues/103-bestpractice--proxy-php-tests-access---server-superglobal-directly--8-occurrences.md)

## Overview

Decouple `SetClientIpMiddleware` from the `$_SERVER` superglobal by injecting
an optional remote-address provider, and rewrite its test suite to inject a
fake provider instead of mutating `$_SERVER['REMOTE_ADDR']` around every
test.

See [proxy.md](proxy.md) for the full plan.
