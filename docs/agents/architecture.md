# Architecture

## Overview

Kerghan is structured as two independent applications — a Node/Express backend and a
React/Vite frontend — served together through the Tent proxy, the same shape Majora uses. This
repository documents the architecture split by concern to keep agent contexts small.

This page is the hub. See the area pages for details:
- [Proxy](./architecture/proxy.md)
- [Frontend](./architecture/frontend.md)
- Backend — not written yet. The Node/Express + Sequelize stack is decided (kerghan.md
  §20/§21), but there's no real API to document until the tracked-repo/label-rule data model is
  decided (kerghan.md §1) and a `backend` agent is created. Write
  `docs/agents/architecture/backend.md` at that point, following `web-server.md` in the `navi`
  checkout as the closest existing precedent for the router/route-register/handlers/serializers
  shape.
