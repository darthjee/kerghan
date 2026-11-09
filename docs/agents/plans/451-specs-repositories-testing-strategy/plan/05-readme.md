# README.md

Update `docs/agents/specs/repos/README.md`:

- **Index:** a `testing.md` row ("Test tiers and default-tier table, GitHub mocking and builders, launcher and clock, race tests, access matrix and canary sweep, module-boundary tooling, frontend spec layers, cache expectations").
- **Open markers:** remove the `#451` row. The table then holds no row, so state "None." (keep the section; #452 checks it).
- **Required tests:** "Every rule is tested from the 'Required tests' section of the file that defines it; tiers, fakes and harnesses are in [testing.md](testing.md)."
- **Decisions summary:** a "Testing (#451)" block with one bullet each for:
  - the DB tier;
  - GitHub mocking;
  - the `Clock`, no-`NOW()` and `SyncLauncher` rules;
  - races;
  - the access matrix and canary sweep;
  - module boundaries;
  - frontend layers;
  - cache;
  - one owner per test.
- **Product changes folded by #452** gains:
  - `architecture/backend.md#testing`: the DB tier (`*.db-spec.ts`, `yarn test:db`, dedicated schema), and the `Clock` / launcher conventions if they generalise; it replaces the "add a `cimg/mysql` service when …" note;
  - `architecture/infra.md`: the MySQL CI job;
  - the Repositories module doc: a "Testing" section from `testing.md`;
  - `contributing.md`: the Repositories ESLint boundary override, if it needs a mention.

## Files to Change

- `docs/agents/specs/repos/README.md` — Index, Open markers, Required tests line, Decisions summary, #452 fold checklist.
