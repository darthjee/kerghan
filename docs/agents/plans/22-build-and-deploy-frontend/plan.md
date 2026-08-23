# Plan: Build and deploy frontend

Issue: [22-build-and-deploy-frontend.md](../../issues/22-build-and-deploy-frontend.md)

## Overview

Codebase inspection during issue discussion showed 3 of the 4 originally-listed deliverables (dev build, dev-mode Vite proxying, production proxy backend routing) are already functional and need no changes. The only remaining code change is removing majora-specific dead code from `bin/deploy_frontend.sh`'s `run_build()`, which belongs entirely to the infra agent's scope (deployment scripts).

See [infra.md](infra.md) for the full plan.
