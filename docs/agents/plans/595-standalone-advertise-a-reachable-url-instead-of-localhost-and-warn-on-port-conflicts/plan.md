# Plan: Standalone: warn on port conflicts on kerghan up and document the macOS AirPlay port clash

Issue: [595-standalone-advertise-a-reachable-url-instead-of-localhost-and-warn-on-port-conflicts.md](../../issues/595-standalone-advertise-a-reachable-url-instead-of-localhost-and-warn-on-port-conflicts.md)

## Overview

`kerghan up` gets a warning, never a failure, when another process already listens on Kerghan's port. It runs just before a new container is created. It is built on a new, reusable `port_listeners` helper (`lsof`, falling back to `ss`), which #597 (`kerghan diagnose`) will reuse. On macOS, a ControlCenter listener on 5000/7000 gets an extra AirPlay Receiver hint. The standalone docs describe the check and the macOS AirPlay clash. The advertised URL, `FRONTEND_BASE_URL` and the published addresses are unchanged; that's #598.

See [standalone.md](standalone.md) for the full plan.
