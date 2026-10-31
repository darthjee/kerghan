# bats tests

Add `standalone/test/wizard.bats` using `helpers/setup.bash`. Feed answers with
`printf '...\n' | KERGHAN_ASSUME_TTY=true "$KERGHAN" wizard`, or with a heredoc. Cover every
item in the "Required tests" list of `docs/agents/specs/client-config/wizard.md`:

- no `KERGHAN_ASSUME_TTY` with a pipe: exit `1`, points to `kerghan configure`, no question
  printed; an unknown option exits `2`;
- question order without `--advanced` (1, 2, 6, 7, 10, 11, 12) and with it (all 13), checked
  from the prompts on stderr;
- all Enter with no `config`: `Nothing changed.`, no files written;
- port `3002` plus confirm: `port=3002`, the change list and the `kerghan up` hint;
- the `bind` default follows the auto-login answer, and Enter writes no `bind` line;
- the default-user skip rule (auto-login `false` with `ENABLED=false` skips; auto-login
  `true` asks);
- an invalid port answer is asked again;
- an invalid `runtime` line is shown as invalid, and Enter writes the default (the file loads
  again);
- password: `g` writes 48 hex characters, never printed, and mentions `kerghan.env`; `t` with
  a match is written; a mismatch and a 7-character value are asked again; with no password,
  `keep` is not offered;
- public URL with `--advanced`: Enter with none set writes nothing, an answer is written;
- the summary masks the password; answering `n` gives `Nothing written.`, exit `0`, and both
  files byte-for-byte unchanged;
- end of input after question 2: exit `1`, nothing written;
- no env and no volume: the file is created as `up` creates it, with the answers applied; with
  a volume (`STUB_VOLUME_EXISTS`): exit `1` before the first question;
- the secrets are never asked; `STUB_LOG` shows no `vault` call.

Also add a test for the invalid-advanced-line exception from the plan Notes.

## Files to Change
- `standalone/test/wizard.bats` — new.
- `.gitguardian.yaml` — ignore entry for fixture passwords, only if needed.
