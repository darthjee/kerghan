# Docs

- `docs/agents/standalone.md`: document `kerghan update-env` in the command list and in the "Secrets" section. It appends missing keys, never edits existing lines, warns on blank keys, fails when the file is missing, and needs `kerghan down && kerghan up` afterwards. Point the pre-#371 paragraph at it.
- `docs/agents/environment-variables.md`: in the "Default user" row, replace "existing files are not modified" with "existing files are not modified automatically; `kerghan update-env` adds the missing keys".
- `docs/agents/specs/default-user/standalone.md`: in "Existing installations", record the name `kerghan update-env`, the missing-file error and the blank-key warning. Change "its name is decided in #372" accordingly. Keep the "Required tests" item in line with the tests from step 04.

## Files to Change
- `docs/agents/standalone.md`
- `docs/agents/environment-variables.md`
- `docs/agents/specs/default-user/standalone.md`
