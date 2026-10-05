# Add keep_signed_in columns
Add the `keep_signed_in` boolean (default `false`, not nullable) to `auth_refresh_tokens` and
`auth_authorization_requests`, and map it on both entities as `keepSignedIn`. Existing rows become
regular (non-persistent) sessions / requests. `down` drops the columns.

Use one migration per table (or a single `auth-add-keep-signed-in` migration touching both — either
is fine), timestamped after the latest existing migration
(`20261002120014-integrations-create-github-app-states.ts`), following the `addColumn` /
`TableColumn({ type: 'boolean', default: false, isNullable: false })` precedent of
`20260903120006-auth-add-users-is-admin.ts`.

## Files to Change
- `backend/src/database/migrations/<timestamp>-auth-add-refresh-tokens-keep-signed-in.ts` — new: adds `auth_refresh_tokens.keep_signed_in`.
- `backend/src/database/migrations/<timestamp>-auth-add-authorization-requests-keep-signed-in.ts` — new: adds `auth_authorization_requests.keep_signed_in`.
- `backend/src/auth/entities/refresh-token.entity.ts` — `@Column({ name: 'keep_signed_in', default: false }) keepSignedIn!: boolean;` + doc-comment mention.
- `backend/src/auth/entities/authorization-request.entity.ts` — same column/property + doc-comment mention.
