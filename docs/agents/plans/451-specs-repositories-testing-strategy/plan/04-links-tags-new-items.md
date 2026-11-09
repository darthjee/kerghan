# Opening links, tier tags and new items

**Opening line.** Every "Required tests" section opens with one line: "Tiers, fakes and harnesses: [testing.md](testing.md)." This replaces:

- `api.md`'s "Backend e2e. How GitHub is mocked and how the sync engine is tested is #451's.";
- `ui.md`'s "The frontend spec strategy is #451's.".

**Exception tags.** Tag only the items whose tier differs from their category's default in `testing.md`'s table. For example:

- an api.md item that needs the DB tier (two concurrent Adds, Add losing to pruning) gets `(db)`;
- a "No query reads `auth_users`…" item gets `(static)`;
- scripted-interleaving items get `(race)`.

**New items:**

- **`sync.md`:**
  - the triggering request answers before the captured task runs, with no GitHub call logged;
  - no SQL time condition uses `NOW()` (`(static)`);
  - every time rule follows the `FakeClock`.
- **`security.md`:**
  - the ESLint override refuses non-exported Integrations/Auth imports and `fetch` in Repositories;
  - the static boundary spec;
  - the route matrix's completeness check;
  - the canary sweep covers every response, header and log line.
- **`integrations.md`:**
  - the fake-fidelity contract spec;
  - the token cache and budget tracker follow the `Clock`.
- **`ui.md`:**
  - the static "no `api.github.com`" spec;
  - the client spec's request targets.
- **`api.md` or `security.md`** (wherever the route matrix item lands): `cache-policy.coverage.spec.ts` asserts `UserScoped` on every Repositories route and on `POST /auth/account/mine.json`.

**`edge-cases.md`.** Its intro under "Required tests" states that every scenario there is a scripted-interleaving (b) spec ([testing.md](testing.md)).

## Files to Change

- `docs/agents/specs/repos/api.md` — opening line, tags.
- `docs/agents/specs/repos/sync.md` — opening line, tags, new items.
- `docs/agents/specs/repos/integrations.md` — opening line, tags, new items.
- `docs/agents/specs/repos/model.md` — opening line, tags.
- `docs/agents/specs/repos/security.md` — opening line, tags, new items.
- `docs/agents/specs/repos/ui.md` — opening line, new items.
- `docs/agents/specs/repos/edge-cases.md` — opening line, scenario type.
