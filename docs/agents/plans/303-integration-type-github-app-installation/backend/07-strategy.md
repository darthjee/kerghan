# Strategy
`GithubAppStrategy` implementing the type contract: `flows: { credentialPaste: false, redirect: true }`,
`isEnabled()` from config, `parseCredential` throws `flowUnsupported()`, `parseSecretPayload`,
`describeMetadata`, `mask`, `test` (transient `unavailable` with no GitHub call while disabled;
otherwise installation service test mapping, refreshing every metadata field but `verifiedBy`,
`expiresAt` stays `null`, never `expired`), `onDelete` no-op. `validate` is not used by the
routes (throw `flowUnsupported()`). Register it in the `INTEGRATION_TYPE_STRATEGIES` factory.

## Files to Change
- `backend/src/integrations/types/github-app/github-app.strategy.ts` — new.
- `backend/src/integrations/tests/github-app.strategy.spec.ts` — new (test outcomes, metadata, mask, delete).
- `backend/src/integrations/tests/integration-type-registry.spec.ts` — github_app enabled/disabled.
