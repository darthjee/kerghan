# Verify
Run, through `docker-compose` only: `docker-compose run --rm kerghan_fe yarn test` and `docker-compose run --rm kerghan_fe yarn lint`. Confirm the spec count is unchanged for the four page specs (plus the new helper spec) and that nothing is skipped. Re-run jscpd (or check the Codacy duplication report) over `frontend/specs/assets/js/components/resources/` and confirm the clones listed in the issue no longer appear.

## Files to Change
- None expected — fix any lint/test failures in the files from steps 01–03.
