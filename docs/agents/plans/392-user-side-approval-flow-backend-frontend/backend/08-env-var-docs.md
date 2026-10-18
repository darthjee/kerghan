# Environment-variable docs

Add a `KERGHAN_USER_APPROVAL_REQUIRED` row to section 1 of `docs/agents/environment-variables.md`
(**Consumed**, optional flag): "When `true`, new self-registrations start `pending` and need an
admin approval; otherwise they start `approved`. Never changes existing users and never disables
the `approved` requirement of the authentication gate. Defaults to off." Source column: the file
that reads it (step 02). The standalone row (section 5) is the standalone agent's.

## Files to Change
- `docs/agents/environment-variables.md` — section 1 row.
