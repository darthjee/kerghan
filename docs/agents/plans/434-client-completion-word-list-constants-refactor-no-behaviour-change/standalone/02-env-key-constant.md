# FRONTEND_BASE_URL env-key constant

Add a constant holding the one known env key outside `DEFAULT_ENV_KEYS`, and replace every code use of the literal with it.

1. Next to `DEFAULT_ENV_KEYS` (~line 354), add e.g. `FRONTEND_BASE_URL_KEY="FRONTEND_BASE_URL"`, with a comment. It says this is the known env key the client doesn't generate: `configure` lists, validates and unsets it, `up`/`update` inject it, the wizard asks for it, and #429 completion offers it. The name of the constant is internal.
2. Replace the literals:
   - `frontend_base_url_args`: `grep -q "^${FRONTEND_BASE_URL_KEY}="` and `printf '%s\n' "-e" "${FRONTEND_BASE_URL_KEY}=http://localhost:$1"`.
   - The `configure` validator: the `case` label becomes `"$FRONTEND_BASE_URL_KEY")`. A single quoted expansion is a valid `case` pattern. Make sure it is quoted, so it matches literally.
   - The `configure` listing: `for key in $DEFAULT_ENV_KEYS $FRONTEND_BASE_URL_KEY` and `in_list … "$DEFAULT_ENV_KEYS $FRONTEND_BASE_URL_KEY"`.
   - The wizard (`env_value_set`, `wizard_env_question`, `wizard_ask`, `batch_add set`): pass `"$FRONTEND_BASE_URL_KEY"`.
3. Leave comments in prose as they are. `--unset` needs no change: nothing in that path spells out the key, and it can be unset because it is not in `DEFAULT_ENV_KEYS`.
4. Afterwards, `grep -n FRONTEND_BASE_URL standalone/bin/kerghan` should show only the constant definition and comments.

## Files to Change
- `standalone/bin/kerghan` — the `FRONTEND_BASE_URL_KEY` constant and its uses.
