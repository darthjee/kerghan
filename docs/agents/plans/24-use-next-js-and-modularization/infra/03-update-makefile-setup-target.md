# Update the Makefile setup target for TypeORM migrations

`make setup` currently runs `docker-compose run --rm $(PROJECT)_app yarn sequelize-cli
db:migrate`. Once `architect` removes the Sequelize CLI config
([Step 02](../architect/02-core-db-and-jwt-guard.md)), this needs to run TypeORM's migration
command instead.

- Update the `setup` target in `Makefile` to run the TypeORM migration command `architect`
  documents in [Step 02](../architect/02-core-db-and-jwt-guard.md) (e.g.
  `docker-compose run --rm $(PROJECT)_app yarn migration:run`, with `backend/package.json`'s
  `migration:run` script wrapping the actual `typeorm-ts-node-commonjs migration:run -d ...`
  invocation) — confirm the exact command against `architect`'s final data-source path before
  finalizing.
- Keep the target name (`setup`) and its `.env` dependency unchanged, per this plan's
  dev-workflow shared contract.

## Files to Change

- `Makefile` — `setup` target's migration command
