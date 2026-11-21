# Migrations and entities

Four migrations, named `<timestamp>-issues-<action>.ts`, with timestamps after `20261113120026`, in the order of `model.md`: `issues-create-issues-projects`, `issues-create-issues`, `issues-create-issues-github-links`, `issues-create-issues-pending-writes`. Write them in the `Table`/`TableIndex` style with `helpers.ts` (`idColumn`, `skipInProduction` as the existing migrations use it); no raw SQL. Each `down` drops its own table, so running them in reverse drops the tables in reverse order.

Columns, exactly as in `model.md`:

- `issues_projects`: `id`, `uuid char(36)`, `user_id int`, `name varchar(100)`, `description varchar(2000) NULL`, `repository_id int NULL`, `deleted_at datetime NULL`, `deleted_token int NOT NULL DEFAULT 0`, `created_at`, `updated_at`. Unique indexes: (`user_id`, `name`, `deleted_token`), (`user_id`, `repository_id`, `deleted_token`), `idx_issues_projects_uuid` (`uuid`).
- `issues`: `id`, `uuid char(36)`, `project_id int`, `title varchar(256)`, `body mediumtext NULL`, `state varchar(16) DEFAULT 'open'`, `created_at datetime`, `updated_at datetime(3)`. Indexes: unique `idx_issues_uuid`, and `idx_issues_project_id_state_created_at`.
- `issues_github_links`: `id`, `user_id`, `issue_id`, `github_issue_id bigint`, `github_number int`, `status varchar(32)`, `status_reason varchar(32) NULL`, `base_title varchar(256)`, `base_body mediumtext NULL`, `base_state varchar(16)`, `github_updated_at datetime NULL`, `last_synced_at datetime NULL`, `etag varchar(255) NULL`, `created_at`, `updated_at`. Unique indexes: (`user_id`, `github_issue_id`) and (`issue_id`).
- `issues_pending_writes`: `id`, `link_id`, `revision int`, `marked_at datetime`, `updated_at datetime`. Unique index on (`link_id`). No payload column.

Index names follow `idx_<table>_<cols>` and stay at 64 characters or less. Add no physical foreign keys.

Timestamps come from the injected `Clock` (`model.md` conventions: never `NOW()` in SQL). Columns must not get a `CURRENT_TIMESTAMP` default unless an existing migration convention requires one. If they do, follow the Repositories migrations exactly. The static `NOW(` spec covers the module sources only.

Entities: `IssuesProject`, `Issue`, `IssueGithubLink` (`github_issue_id` with a `from: Number` transformer, as Repositories' `github_id`) and `IssuePendingWrite`, exported as `ISSUES_ENTITIES` from `entities/index.ts`. Entities do not set `uuid`: later services generate it with `randomUUID()` at insert.

## Files to Change
- `backend/src/database/migrations/2026…-issues-create-issues-projects.ts` (and the three others) — new.
- `backend/src/issues/entities/issues-project.entity.ts`, `issue.entity.ts`, `issue-github-link.entity.ts`, `issue-pending-write.entity.ts`, `index.ts` — new.
