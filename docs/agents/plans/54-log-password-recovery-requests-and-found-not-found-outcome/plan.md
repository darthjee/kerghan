# Plan: Log password-recovery requests and found/not-found outcome

Issue: [54-log-password-recovery-requests-and-found-not-found-outcome.md](../../issues/54-log-password-recovery-requests-and-found-not-found-outcome.md)

## Overview

Add two `info`-level log lines to `PasswordResetService#recover` — one for every incoming
password-recovery request, one recording whether the submitted email matched an account — via the
already-landed Core `LoggerService`. Backend-only change; no other agent's scope is touched.

See [backend.md](backend.md) for the full plan.
