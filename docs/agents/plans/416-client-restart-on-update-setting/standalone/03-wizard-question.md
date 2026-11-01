# `wizard` question

In `wizard_questions`, right after `wizard_config_question bind "Bind address"` and before the default-user (`KERGHAN_DEFAULT_USER_ENABLED`) block, add an unconditional:

```bash
wizard_config_question restart-on-update "Restart after update (ask/always/never)"
```

It is asked with and without `--advanced`. Through `wizard_config_question` it already gets:

- the bracket convention: `Restart after update (ask/always/never) [ask]:` (or the current file value);
- Enter keeps the bracketed value, writing nothing when the key has no line;
- an invalid answer re-asked after the validator's message;
- an invalid current line shown as `[ask] (current value '<v>' is invalid)`, with Enter writing `ask`.

Make sure `is_bool_key` does **not** include this key, so `y` / `n` are not translated and are refused like any other invalid answer. Update the wizard's comments that number or list the questions if they reference the question table.

## Files to Change
- `standalone/bin/kerghan` — `wizard_questions` (and any question-list comment).
