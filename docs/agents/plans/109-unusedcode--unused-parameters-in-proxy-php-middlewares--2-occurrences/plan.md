# Plan: UnusedCode: unused parameters in proxy PHP middlewares (2 occurrences)

Issue: [109-unusedcode--unused-parameters-in-proxy-php-middlewares--2-occurrences.md](../../issues/109-unusedcode--unused-parameters-in-proxy-php-middlewares--2-occurrences.md)

## Overview
Two Codacy `UnusedFormalParameter` findings in `proxy/extension/lib/middlewares/`, each needing a different fix: `SetClientIpMiddleware::build()` keeps its required `$attributes` parameter (inherited `Middleware::build()` contract) with an inline PHPMD suppression, while `TestHeaderMiddleware::handle()` drops its unused `$request` parameter entirely since no contract enforces it.

See [proxy.md](proxy.md) for the full plan.
