# Cache Plan: User-side approval flow (backend + frontend)

Main plan: [plan.md](plan.md)

## Shared contracts

The changed routes (`register.json`, `login.json`, `status.json`, `refresh.json`, `recover.json`,
`reset-password.json`, `logoff.json`, authorization-request `poll.json`) stay
`@CachePolicy(CacheClass.Never)` at controller level, sending `X-Skip-Cache: true` and
`Cache-Control: no-store`.

## Implementation Steps

### Step 1 — Review cache policy

After the backend work, review (read-only) that every changed route still sends
`X-Skip-Cache: true` (`auth.controller.skip-cache.e2e-spec.ts` should cover `status.json`'s
pending answer too) and confirm none of them belongs in `navi/resources/*.yml`. Report
violations to the backend agent; no Navi change is expected.

## Files to Change
- None expected (`navi/resources/*.yml` unchanged).
