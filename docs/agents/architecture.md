# Architecture

## Overview

Kerghan is structured as two independent applications — a Node/Express backend and a
React/Vite frontend — served together through the Tent proxy, the same shape Majora uses. This
repository documents the architecture split by concern to keep agent contexts small.

This page is the hub. See the area pages for details:
- [Proxy](./architecture/proxy.md)
- [Frontend](./architecture/frontend.md)
- [Backend](./architecture/backend.md) — precedent only, no real API exists yet. The
  tracked-repo/label-rule data model (see `docs/agents/product.md`) needs to be decided, and a
  `backend` agent created, before this becomes a real architecture page.
