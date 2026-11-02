# Test helper and `completion.bats`

Build the harness from README `## Testing` → `### Harness`, then the matrix and edge-case tests from `completion.md` → `### completion.bats`.

- **`standalone/test/helpers/completion.bash`:** loaded after `helpers/setup.bash`, reusing its temp `HOME` and failing stubs. It provides:
  - `source_completion`: writes `"$KERGHAN" completion bash` to `$BATS_TEST_TMPDIR/completion.bash` and sources it into the test shell itself, not through `run`;
  - `complete_words LINE -- WORD...`: sets `COMP_LINE`, `COMP_POINT=${#LINE}`, `COMP_WORDS` and `COMP_CWORD` (the last index), then calls `_kerghan kerghan "$cur" "$prev"`;
  - `complete_line LINE`: splits on whitespace only, so a trailing space gives an empty last word, and fails the test if `LINE` contains `=` or `:`;
  - `assert_reply WORD...`: compares exactly and order-insensitively, with trailing spaces significant; on failure it prints expected vs actual with each word bracketed;
  - `assert_no_reply`.

  The helper itself must run on bash 3.2 (no `mapfile`, no associative arrays). Sort with a plain loop, or with `printf … | sort` in the test shell. The deny-list only applies to the generated script.
- **`standalone/test/completion.bats`:**
  - one `@test "matrix <label>: …"` per row of the per-position table, with the exact input and `COMPREPLY` from the "Required tests" tables;
  - one `@test "edge <n>: …"` per numbered edge case;
  - the registration check: `complete -p kerghan` prints exactly `complete -o nospace -F _kerghan kerghan`;
  - every `=` case in each shape the spec names (`(… variant =)`, `(… variant = '')`, `(… variant = on)`), all under one label.
- **Check `setup.bash` on bash 3.2:** these files load `helpers/setup.bash` under bash 3.2 in the new run. If anything in it fails there, fix it in `setup.bash` without changing behaviour on bash 5.

## Files to Change

- `standalone/test/helpers/completion.bash`: new; the completion harness.
- `standalone/test/completion.bats`: new; matrix, edge cases, registration and the dual `=` shapes.
- `standalone/test/helpers/setup.bash`: only if a bash 3.2 incompatibility shows up.
