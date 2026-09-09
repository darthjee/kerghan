# Plan: Backend: rate-limiting and abuse hardening for authorization requests

Issue: [66-backend--rate-limiting-and-abuse-hardening-for-authorization-requests.md](../../issues/66-backend--rate-limiting-and-abuse-hardening-for-authorization-requests.md)

## Overview

Adds config-driven rate limiting and abuse hardening to `AuthorizationRequestService`: per-IP/per-username
throttling and a concurrent-`open` cap on `create`, a failed-attempt cool-off on `authorize`, DTO length
caps, and trusted-proxy-hop-count hardening for client-IP resolution — all without weakening the existing
enumeration-safety and timing-safety guarantees.

See [backend.md](backend.md) for the full plan.
