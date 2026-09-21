# Plan: Refactor: dedupe ApiClientSpec 401-refresh scenarios and AccountsClientSpec setup

Issue: [177-refactor-dedupe-apiclientspec-401-refresh-scenarios-and-accountsclientspec-setup.md](../../issues/177-refactor-dedupe-apiclientspec-401-refresh-scenarios-and-accountsclientspec-setup.md)

## Overview
Spec-only refactor under `frontend/specs/`: extract the fetch/session-stub setup used by the `401 handling` tests into a shared support helper, and table-drive the near-identical `AccountsClientSpec` cases. Spec assertions stay unchanged.

See [frontend.md](frontend.md) for the full plan.
