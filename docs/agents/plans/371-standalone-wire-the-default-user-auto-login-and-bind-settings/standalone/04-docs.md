# Docs: config.example and help text

Document the new settings where users look for them.

- `standalone/config.example`: add `#auto-login=true` and `#bind=` blocks. Explain the defaults (bind `127.0.0.1` with auto-login on, `0.0.0.0` with it off), the flags (`--auto-login`, `--no-auto-login`, `--bind ADDRESS`), that anyone reaching the port is logged in as admin when auto-login is on, that the `admin` password is in `~/.kerghan/kerghan.env` for manual login, and that sessions created by automatic login stay valid until they expire after turning it off. Add `auto-login` and `bind` to the header sentence listing the settings that recreate the instance.
- `usage()` in `standalone/bin/kerghan`: add the flags to the `up` line and "Options for up", add `auto-login=true` and `bind=` to the settings list, and add them to the "recreates the instance" sentence. Update the header comment listing persistent settings.
- `docs/agents/standalone.md`: only if it lists the client settings or flags, add the two new ones briefly. The full fold-in of the spec is #373.

## Files to Change
- `standalone/config.example` — new settings.
- `standalone/bin/kerghan` — `usage()` and header comment.
- `docs/agents/standalone.md` — settings list, if one exists.
