# Issue: Specs: default user feature definition

## Description

Part of #366 (Epic: environment-configured default user with optional always-on authentication). First sub-issue of the Epic.

Write the feature specs for the default-user feature under `docs/agents/specs/default-user/`, following the lifecycle and conventions in `docs/agents/specs.md`. Register the feature under "Active specs" in `docs/agents/specs.md`. While these specs exist, they are the source of truth for every other sub-issue of #366.

## Problem

#366 spreads its decisions across a long Epic body. Several sub-issues (#368–#372) consume the same shared contracts: variable names, the `DefaultUserConfig` interface, how automatic login behaves, and the standalone defaults. Without a single written definition, each implementation issue would have to re-read the Epic and risk making its own diverging decisions. `docs/agents/specs.md` exists for exactly this: a temporary, agreed definition that the implementation sub-issues build against.

## Expected Behavior

- `docs/agents/specs/default-user/` exists with the files listed in the Solution, each ending with "Required tests".
- `docs/agents/specs.md` lists the feature under "Active specs".
- No code changes.

### Edge cases

1. **Source of truth after merge.** Once this issue is merged, `docs/agents/specs/default-user/` becomes the source of truth, and #366's body is no longer kept up to date. Any later change to a decision is made in the spec, in the same PR that changes it, following `docs/agents/specs.md`. The `README.md` states this explicitly.
2. **Placeholders block implementation.** The placeholders for #374 and #375 say "to be defined by #374 / #375; do not implement before then", so #369 and #370 do not start against an incomplete contract.
3. **Merge order.** #374 and #375 edit files created here, so they start only after this issue is merged.
4. **No credential-like examples.** Examples of `kerghan.env` and the variables use obvious placeholders (`<generated>`, `example-password`), never values that look like real secrets. The docs are public.
5. **"Active specs" is currently "none".** The new entry replaces that line rather than being added next to it.
6. **Temporary duplication is expected.** While the spec is active, the `KERGHAN_DEFAULT_USER_*` variables are documented only in the spec, not in `environment-variables.md`, until #373 folds them in. The `README.md` notes this, so nobody "fixes" it early.

## Solution

### Spec files

The specs capture every decision recorded in #366. Proposed files:

- `README.md`: overview, purpose, scope and out-of-scope, the product decision, and an index of the other files.
- `configuration.md`: the `KERGHAN_DEFAULT_USER_*` variables (`ENABLED`, `ALWAYS_AUTHENTICATED`, `USERNAME`, `EMAIL`, `PASSWORD`, `ADMIN`, `ALLOWED_IPS`, `ALLOW_IN_PRODUCTION`) and the `DefaultUserConfig` class and its methods. Rules:
  - always-authenticated implies enabled;
  - required values when enabled;
  - `ADMIN` defaults to `false`;
  - only the exact string `true` turns a flag on;
  - an empty `ALLOWED_IPS` means loopback only;
  - an invalid IP or CIDR fails at boot;
  - the production guard.
- `boot-sync.md`: creates the user, or overwrites its email, password and admin flag:
  - no rehash when the password is unchanged;
  - revoke sessions when the password changes;
  - a unique-constraint race is handled as an update;
  - an email that collides with another user fails at boot;
  - edits of the default user are blocked through `account.json` and the admin endpoints while enabled.
- `automatic-login.md`: automatic login happens only in `status.json`, and only with no valid session (an existing session or refresh wins), for an allowed client IP resolved with `KERGHAN_TRUSTED_PROXY_HOPS`. Covers the boot warning log, and states that sessions stay valid after the feature is turned off.
- `security.md`: IP allowlist, production guard (`KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION`), the reason the guard is excluded (session flooding), credential handling, and admin access.
- `standalone.md`:
  - compose pass-through;
  - `kerghan.env` defaults for new installations (`admin` / `admin@kerghan.local`, a strong random password, admin on);
  - `auto-login` and `bind` settings and flags, with their defaults and precedence;
  - the update command for older `kerghan.env` files;
  - the open client-IP technical risk inside Docker-in-Docker / Tent.

Each spec file ends with a "Required tests" section.

### Scope: in

- Create `docs/agents/specs/default-user/` with a `README.md` and the files split by concern listed above.
- Register the feature under "Active specs" in `docs/agents/specs.md`. That is the only change outside the spec folder, as in the precedent #337.
- Transcribe **every** decision recorded in #366, including edge cases, security, the open technical risk, and the sub-issue dependencies.
- End each spec file with a "Required tests" section that the implementation sub-issues must cover.
- In `README.md`, map each spec file to the sub-issue that implements it:
  - `configuration.md` → #368
  - `boot-sync.md` → #369
  - `automatic-login.md` → #370
  - `standalone.md` → #371 and #372

### Scope: out

- Any code (backend, standalone, frontend).
- Permanent docs (`environment-variables.md`, `standalone.md`, `product.md`, `modules/`, …). They are untouched until #373 folds the specs into them.
- `CLAUDE.md` / `AGENTS.md`: they link only to the specs hub.
- Resolving the open technical risk (the effective client IP inside Docker-in-Docker / Tent). The spec records it as open and assigns it to #371.
- New decisions. The spec records only what #366 decided. API contracts not yet decided are split out into their own spec sub-issues, which build on top of this folder:
  - #374: API contract for edits blocked on the default user. #369 depends on it.
  - #375: `status.json` contract for automatic login. #370 depends on it.

  This issue leaves placeholders in the relevant files pointing to #374 and #375.

## Benefits

- One source of truth for every sub-issue of #366. Implementers read only the spec file their sub-issue needs.
- The decisions from the #366 discussion are preserved in the repo, not just in a GitHub issue body.
- Open API contracts are explicitly isolated in #374 and #375, so no implementation starts against an undecided contract.
