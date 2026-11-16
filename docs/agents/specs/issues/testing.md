# Issues and Projects — Testing

Purpose: the test strategy of the feature (tiers, fixtures, how workers and security rules are tested).
Part of the [Issues and Projects specs](../issues.md).

No strategy decided yet. Data-model tests run in the DB-backed tier, as Repositories; [model.md's required tests](model.md#required-tests) feed #494.

## Open questions

- [ ] Test tiers. (#494)
- [ ] Fixtures, such as a fake GitHub client and a controllable clock. (#494)
- [ ] Worker tests on the #479 infrastructure, including the restart case. (#494)
- [ ] Coverage per area. (#494)
- [ ] How the security rules are verified. (#494)

## Required tests

None yet.
