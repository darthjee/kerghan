# README testing strategy and row labels

Write the testing strategy once, in `README.md`, and give every per-position table row a stable label that tests cite.

**`README.md`**

- Replace the short `## Required tests` section with a `## Testing` section (keep the line "Every rule is tested from the "Required tests" section of the file that defines it."). Its subsections, with the content from the issue:
  - **Harness:**
    - the `helpers/completion.bash` functions and what each one sets or asserts;
    - the cursor-at-end rule;
    - why tests call `_kerghan` directly instead of simulating readline;
    - the dual `=` shapes: `kerghan configure variant=` as `(… variant =)` and as `(… variant = '')`, and `variant=on` as `(… variant = on)`.
  - **Fresh-shell tests:** hygiene and safety tests run outside the bats shell, and the snapshot list.
  - **bash 3.2:**
    - the image, the service, the CI job, the glob and the `KERGHAN_TEST_BASH32` guard;
    - "same tests on both versions";
    - the rejected options: the whole suite (that is #433) and a static lint.
  - **File layout:** the five-file table from the issue, plus the two notes below it.
  - **Naming and coverage:**
    - the `matrix`, `edge` and `contract` prefixes;
    - the coverage rule;
    - no coverage table and no meta-test, and why.
  - **Out of scope here:** who builds what. #429 writes the client tests and builds the bash 3.2 image, service and job; #430 writes the installer tests and the detection override.
- In `## Open markers`, remove the `#428` row. The table is then empty: replace it with one line saying no open marker remains and #431 checks that.
- In `## Sub-issue map`, update the `#428` "Reads" cell if needed, and in `## Index` mention the testing section.
- In the "Who reads what" paragraph, add that #429 and #430 also read the `README.md` testing section.

**`completion.md`, per-position tables**

Add a first `Label` column to the three tables under `### Per-position table`, with these labels (unique across the tables):

| Table | Row | Label |
|-------|-----|-------|
| Top level | First word after `kerghan` | `top-first` |
| Top level | Any later word … | `top-later` |
| Commands | `up`, previous word is `-p`, `--port` or `--bind` | `up-flag-arg` |
| Commands | `up`, any other position | `up-flags` |
| Commands | `logs` | `logs` |
| Commands | `update` | `update` |
| Commands | `wizard` | `wizard` |
| Commands | `completion`, first argument | `completion-first` |
| Commands | `completion`, any later argument | `completion-later` |
| Commands | `down`, `status`, … | `no-args` |
| `configure` | previous word is `--unset` | `cfg-unset` |
| `configure` | fixed-value `KEY=` | `cfg-value` |
| `configure` | other `KEY=…`, or `KEY=-` | `cfg-free` |
| `configure` | `--show-secrets` mode | `cfg-show-secrets` |
| `configure` | any other position, otherwise | `cfg-other` |

Add one sentence after the Terms list saying that labels are stable once tests cite them (`@test "matrix <label>: …"`, see [README.md](README.md#testing)). In `#### Edge cases in the table`, add the row labels next to the existing links where it helps (e.g. edge case 8 → `up-flag-arg`).

## Files to Change
- `docs/agents/specs/auto-complete/README.md` — new `## Testing` section, the #428 open-marker row removed, map/index/who-reads touch-ups.
- `docs/agents/specs/auto-complete/completion.md` — `Label` column on the per-position tables, the stability sentence, labels in the edge-case map.
