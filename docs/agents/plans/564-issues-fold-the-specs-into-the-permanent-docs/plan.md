# Plan: Issues: fold the specs into the permanent docs

Issue: [564-issues-fold-the-specs-into-the-permanent-docs.md](../../issues/564-issues-fold-the-specs-into-the-permanent-docs.md)

## Overview

This is the last issue of epic #483. It moves everything the Issues and Projects specs decided into permanent docs: a `modules/issues.md` hub with pages, and a `backend/routes/issues.md` hub with pages, laid out like the Repositories fold (#444). It rewrites the fold-list statements in `product.md`, `architecture/security.md`, `summary.md` and `flow.md`, and applies the approved `AGENTS.md` and `CLAUDE.md` wording. It repoints every reference to `docs/agents/specs/issues` in the docs, the agent files and the code, and audits the Required tests, filling any gap. It then deletes the spec folder and moves the feature to *Completed specs*. No product behavior changes.

## Agents involved

- [architect](architect.md): the docs, the agent files, the root files and the final deletion. The issue names `architect` as the responsible agent, so it has its own file even though it also coordinates.
- [backend](backend.md): 71 backend files cite the spec path, including `eslint.config.mjs`. `edge-cases.coverage.spec.ts` reads the spec file from disk. Backend Required-test gaps.
- [frontend](frontend.md): three frontend files cite the spec path. Frontend Required-test gaps.

## Shared contracts

**Path mapping.** Every agent repoints with this table. Each target page keeps the `##` and `###` headings of its source file verbatim, so every `#anchor` survives the move: only the path part of a reference changes.

| Spec path (`docs/agents/specs/...`) | Permanent path (`docs/agents/...`) |
|---|---|
| `issues.md` | `modules/issues.md` |
| `issues/model.md` | `modules/issues/data-model.md` |
| `issues/projects.md` | `modules/issues/projects.md` |
| `issues/github-link.md` | `modules/issues/github-link.md` |
| `issues/sync.md` | `modules/issues/sync.md` |
| `issues/security.md` | `modules/issues/security.md` |
| `issues/edge-cases.md` | `modules/issues/edge-cases.md` |
| `issues/testing.md` | `modules/issues/testing.md` |
| `issues/ui.md` | `modules/issues/frontend.md` |
| `issues/ui/<page>.md` (`decisions`, `linking-and-sync`, `screens-and-flows`, `states`) | `modules/issues/frontend/<page>.md` |
| `issues/api.md` | `backend/routes/issues.md` |
| `issues/api/<page>.md` (`errors-and-validation`, `github-link`, `issues`, `projects`) | `backend/routes/issues/<page>.md` |

A bare name inside a comment (for example "`edge-cases.md`" right after a full path) follows the same table.

**Edge-case page format.** `docs/agents/modules/issues/edge-cases.md` keeps every matrix row as `| E<n> | ...`, with the ids unchanged and none renumbered. `edge-cases.coverage.spec.ts` matches `/^\| (E\d+) \|/gm`.

**Required tests.** Each page keeps its `## Required tests` section. A new `docs/agents/modules/issues/required-tests.md` indexes them, listing each Required test with the spec file that implements it. Backend and frontend each report their audit back as a list: the Required test, the spec file and tier that cover it, and any test they added.

**Order.** The architect writes the new pages first (steps 01 to 05). Backend and frontend repoint against the mapping table, which does not need the pages to exist. The architect deletes the spec folder last (step 07), after the backend coverage spec points at the new edge-case page.
