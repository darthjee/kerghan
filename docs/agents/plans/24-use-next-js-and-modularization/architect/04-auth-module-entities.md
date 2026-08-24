# Auth module: entities

Create the Auth module's TypeORM entities, replacing the current bare Sequelize `User` model
with the full set the issue calls for (user, refresh token, session), each owning tables under
the `auth_` prefix per the issue's database strategy (no physical cross-module FKs — logical
foreign keys only).

- `backend/src/auth/entities/user.entity.ts` — carries over the columns from the existing
  `backend/models/User.js` / `backend/migrations/20260808060719-create-users.js` (check both for
  the authoritative current shape), mapped to table `auth_users`.
- `backend/src/auth/entities/refresh-token.entity.ts` — `auth_refresh_tokens`: token hash, user
  ID (logical FK), issued/expiry timestamps, rotation state.
- `backend/src/auth/entities/session.entity.ts` — `auth_sessions`: session ID, user ID (logical
  FK), created/last-seen timestamps.
- `backend/src/database/migrations/<timestamp>-auth-create-users.ts`,
  `<timestamp>-auth-create-refresh-tokens.ts`, `<timestamp>-auth-create-sessions.ts` — TypeORM
  migrations for the three tables, named per the issue's
  `<timestamp>-<module>-<action>.ts` convention.
- Remove the superseded Sequelize artifacts once the TypeORM equivalents are in place:
  `backend/models/User.js`, `backend/models/index.js`, `backend/migrations/*`,
  `backend/seeders/*` (re-create the demo-user seed as a TypeORM seed/migration if the dev
  workflow depends on it — check `docs/agents/*` and `.env.dev.sample` for references before
  dropping it silently).

## Files to Change

- `backend/src/auth/entities/user.entity.ts` — new
- `backend/src/auth/entities/refresh-token.entity.ts` — new
- `backend/src/auth/entities/session.entity.ts` — new
- `backend/src/database/migrations/` — new TypeORM migrations for the three `auth_` tables
- `backend/models/`, `backend/migrations/`, `backend/seeders/` — removed (superseded)
