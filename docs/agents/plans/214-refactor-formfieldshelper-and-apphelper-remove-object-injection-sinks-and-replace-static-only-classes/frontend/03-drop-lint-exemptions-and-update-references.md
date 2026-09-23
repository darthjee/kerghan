# Drop lint exemptions and update convention references

- In `frontend/eslint.config.mjs`, remove `'assets/js/components/common/forms/helpers/FormFieldsHelper.jsx'` and `'assets/js/components/helpers/AppHelper.jsx'` from the `reportUnusedDisableDirectives: 'off'` file list. Those files no longer carry Codacy-only suppressions. #212 removed its login-modal files from this list the same way.
- `HeaderHelper.jsx`'s disable comment says it matches `components/helpers/AppHelper.jsx`, which will no longer be a static class. Reword the comment so it no longer points at `AppHelper`, for example by referring to the pending migration to the object-module shape. Do not migrate `HeaderHelper` itself; that belongs to a separate issue.
- In `.claude/agents/frontend.md` ("Helper module shape"), remove `#214` from the "Older helpers/clients are still static classes and are being migrated (#214, #227–#230)" note.

## Files to Change
- `frontend/eslint.config.mjs`: remove the two files from the unused-directive exemption list.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`: comment only, remove the stale `AppHelper` reference.
- `.claude/agents/frontend.md`: remove `#214` from the pending-migration list.
