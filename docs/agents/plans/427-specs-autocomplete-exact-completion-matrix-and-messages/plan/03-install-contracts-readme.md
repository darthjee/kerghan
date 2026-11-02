# install.md messages, contracts.md alias line, README

## install.md

**`## Messages`:** replace the Open marker. All messages go through the installer's existing helpers: `info` on stdout, `warn` and `hint` on stderr, all prefixed `kerghan-install:`. `<file>` is the resolved target path, `<dir>` its directory, and `<install dir>` the absolute install directory.

- **Success:** `kerghan-install: bash completion installed to <file>`, printed after `kerghan <version> installed to …` and before `check_path`'s output.
- **bash-completion not detected:** printed after the success line,

  ```
  kerghan-install: hint: bash-completion was not found; to enable completion, add this to ~/.bashrc:
    source "<file>"
  ```

  The second line is printed with `echo … >&2`, like `check_path`'s `export PATH` line.
- **Failures:** one `warning:` line, and no success line or hint:
  - `kerghan-install: warning: could not create <dir>; skipping bash completion`
  - `kerghan-install: warning: <install dir>/kerghan completion bash failed; skipping bash completion` (a non-zero exit or empty output)
  - `kerghan-install: warning: could not write <file>; skipping bash completion` (a temp-file write or `mv -f` failure)
- **`KERGHAN_COMPLETION=false`:** nothing printed.

**`## Without the bash-completion package`:**

- Add the **detection rule**. bash-completion counts as installed when any of these files exists:
  - `/usr/share/bash-completion/bash_completion` (Linux distros)
  - `/opt/homebrew/etc/profile.d/bash_completion.sh` (Homebrew, Apple silicon)
  - `/usr/local/etc/profile.d/bash_completion.sh` (Homebrew, Intel)
  - `/opt/local/etc/profile.d/bash_completion.sh` (MacPorts)

  The step never runs bash-completion and never reads rc files.
- The hint shows `source "<file>"`. Drop the `eval "$("<install dir>/kerghan" completion bash)"` alternative from the hint text, but keep it mentioned as a manual option in the prose.
- Link to Messages.

**`## Required tests`:** add:

- The success line text.
- The exact two-line hint when none of the detection paths exists, and no hint when one does. The paths can be made to exist under a test root, or the list made overridable for tests; leave that choice to #428.
- Each warning's text.
- Nothing printed with `KERGHAN_COMPLETION=false`.

## contracts.md

`_kerghan` section and line 87: the alias line becomes `complete -o nospace -F _kerghan <name>`. Note that `-o nospace` is part of what users copy: without it, `KEY=` completions get a trailing space.

## README.md

- **Open markers table:** remove the three #427 rows.
- **Index:** the `command.md` row can mention "exact messages"; the `install.md` row can mention "messages, bash-completion detection".

## Files to Change
- `docs/agents/specs/auto-complete/install.md` — Messages, detection rule and hint in "Without the bash-completion package", Required tests.
- `docs/agents/specs/auto-complete/contracts.md` — alias line with `-o nospace`.
- `docs/agents/specs/auto-complete/README.md` — remove the #427 open-marker rows; touch up the Index.
