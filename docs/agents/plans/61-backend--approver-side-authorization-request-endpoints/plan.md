# Plan: Backend: approver-side authorization-request endpoints

Issue: [61-backend--approver-side-authorization-request-endpoints.md](../issues/61-backend--approver-side-authorization-request-endpoints.md)

## Overview

Add the three authenticated routes an already-logged-in device uses to see and act on
authorization requests raised against its own username (`mine`, `authorize`, `deny`), completing
the backend half of #58's login-by-authorization flow on top of the entity/create/poll work
already shipped in #60.

See [backend.md](backend.md) for the full plan.
