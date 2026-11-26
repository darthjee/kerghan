# Plan: Standalone: make the advertised URL reach the instance

Issue: [598-standalone-make-the-advertised-url-reach-the-instance.md](../../issues/598-standalone-make-the-advertised-url-reach-the-instance.md)

## Overview

The `kerghan` client stops advertising `http://localhost:<port>` and prints the address the
instance is actually published on (`127.0.0.1` for the default bind and `0.0.0.0`, the bind
address otherwise). The derived `FRONTEND_BASE_URL` and the wizard default follow the same rule,
and the docs, `config.example` and CI scripts are updated. Owned entirely by the standalone agent.

See [standalone.md](standalone.md) for the full plan.
