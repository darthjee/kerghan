# security.md
Write `docs/agents/specs/client-config/security.md`.

Sections:
- **Context** — `kerghan.env` is the source of truth for the default user (boot sync overwrites
  email, password, admin flag; a password change revokes its sessions — link
  `../../modules/auth/default-user.md`), so these commands rotate the admin password.
- **Masking** — which keys are secret (`KERGHAN_DEFAULT_USER_PASSWORD`, `KERGHAN_SECRET_KEY`,
  `KERGHAN_INTEGRATIONS_KEY`); `******** (set)` in listing and single reads unless
  `--show-secrets`; changes print `<KEY>: changed`.
- **Inline secrets** — `KEY=value` still works for a secret key, with a hint pointing to `=-`
  (shell history, `ps`).
- **Secrets and `--force`** — required for the two secrets; warning (logs everyone out,
  stored integration credentials unreadable, back up `kerghan.env`); `[y/N]` on a TTY, `--force`
  alone without one; declined → exit 1.
- **Cross-key warnings** — edge case 12 (auto-login + non-loopback bind: same warning as `up`;
  auto-login without default-user credentials: warn `up` will fail, unless the same call sets
  them).
- **File safety** — temp file mode 600 before rename; symlinks written through.
- **Password change** — apply-hint note.
- **Performance** — no container started or inspected; only the read-only volume check of
  `files.md` case 3.
- **Required tests** — one line per scenario.

## Files to Change
- `docs/agents/specs/client-config/security.md` — new.
