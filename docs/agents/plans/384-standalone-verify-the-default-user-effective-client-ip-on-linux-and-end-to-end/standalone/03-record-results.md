# Record the reported results
**Blocked on the user.** Do this only after the user has pasted the script reports for checks 1–6 (step 02's checklist). Never fill in results that were not reported.

- Extend the measurement table under "Effective client IP" in `docs/agents/standalone.md` with one row per run: platform, Docker Desktop or native, Engine version, runtime, outer publish/bind, request origin, and the address seen. Add the date and note that it was measured by #384.
- Update the notes below the table. Say whether the effective IP is stable across hosts. Say whether the full private-range allowlist is still justified or could be narrowed; narrowing would be a follow-up issue, not done here. Say whether `KERGHAN_TRUSTED_PROXY_HOPS` still needs no setting. Add the macOS `0.0.0.0` finding (the cause, or "reproduced, cause unconfirmed" / "not reproduced").
- Update "Caveats": remove each "not verified yet" item that now has a result, keep the ones still open, and update the moby#45610 caveat with the Engine 28+ result.
- For any result that shows the allowlist, the trusted hops or the default `bind` is wrong, open a separate GitHub issue and link it from the relevant note or caveat.

## Files to Change
- `docs/agents/standalone.md` — "Effective client IP" table and notes, and the "Caveats" list.
