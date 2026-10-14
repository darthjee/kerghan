# Backend variables in environment-variables.md

Add the default-user variables to section 1 ("Backend application runtime"), following the
existing table and prose style there. Source: `specs/default-user/configuration.md` (Variables,
Flag values, Value handling, Validation at boot) and `security.md` (Production guard).

- One row per variable: `KERGHAN_DEFAULT_USER_ENABLED`, `_USERNAME`, `_EMAIL`, `_PASSWORD`,
  `_ADMIN`, `_ALWAYS_AUTHENTICATED`, `_ALLOWED_IPS`, `_ALLOW_IN_PRODUCTION`, each with its
  default and meaning.
- The accepted flag values, trimming and blank handling, and the boot validation rules (which
  combinations refuse to boot, including automatic login without credentials and the production
  guard).
- Link to `modules/auth/default-user.md` for the behavior.
- In section 5, keep the "Default user" row and make it point to section 1 for the definitions.

## Files to Change
- `docs/agents/environment-variables.md` — new default-user entries in section 1, cross-link from section 5.
