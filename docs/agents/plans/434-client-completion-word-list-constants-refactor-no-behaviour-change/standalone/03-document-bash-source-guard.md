# Document the BASH_SOURCE guard

In the client header, right after the bash 3.2 compatibility paragraph, add a short paragraph. It says the trailing `if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi` guard lets the client be sourced without running `main`. It is an internal test contract: the completion sync tests (#429) source the client to read its constants (`CONFIG_KEYS`, `DEFAULT_ENV_KEYS`, the `*_VALUES` constants, `FRONTEND_BASE_URL_KEY`). It is not user-facing, and the guard must stay. Also add a one-line comment above the guard itself that points back to the header.

## Files to Change
- `standalone/bin/kerghan` — the header paragraph and the comment on the guard.
