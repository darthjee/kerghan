# Consistency check and agent review

1. `grep -rn '#448' docs/agents/specs/repos/` finds no "Open — settled by #448" note and no
   marker row; remaining mentions are history only.
2. Values agree everywhere: thresholds (sync ≤ 10, Add ≤ 0), 3-call cap, 2 MiB / 64 KiB caps,
   `expires_at` − 5 min, `metadata: read`, the endpoint parameters.
3. No file still says the unauthenticated client lives in Repositories, or that Add honours the
   sync threshold.
4. Every relative link and anchor added resolves.
5. `git diff --stat origin/main` touches only `docs/agents/specs/repos/` (plus this plan and the
   issue file); no code.
6. Read-only reviews, findings applied before finishing: `security` (credential containment,
   redirect rule, budget starvation wording), `backend` (interface feasibility with the existing
   client, event-emitter use, token cache), `data-access` (user scoping of the listener and
   `listUsableIntegrations`), `product-owner` (usable rule and non-usable sources kept listed).

## Files to Change
- Any spec file the checks flag.
