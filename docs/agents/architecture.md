# Architecture

## Overview

Kerghan is structured as two independent applications — a NestJS backend and a React/Vite
frontend — served together through the Tent proxy, the same shape Majora uses. This repository
documents the architecture split by concern to keep agent contexts small.

This page is the hub. See the area pages for details:
- [Proxy](./architecture/proxy.md)
- [Frontend](./architecture/frontend.md)
- [Backend](./architecture/backend.md) — NestJS + TypeORM + MySQL stack, layout, build, and
  testing conventions. The tracked-repo/label-rule data model (see `docs/agents/product.md`) is
  still open — only the Auth module exists so far.
- [Modular Pattern](./architecture/modular-pattern.md) — the cross-cutting rules (module
  classification, lazy loading, inter-module communication, database strategy) every backend
  module, present or future, must follow.
- [Infra](./architecture/infra.md) — the CircleCI release pipeline's job graph (test/lint jobs,
  the semver-tag-gated release chain, and the base-image publish jobs feeding it).
