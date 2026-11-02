# install.sh header

Update the header comment of `standalone/install.sh`; #430 owns this, per the issue.

- **Variables block:** add `KERGHAN_COMPLETION`, aligned with the other two entries, e.g. `set to false to skip installing bash completion (default: installed)`. Do **not** document `KERGHAN_BASH_COMPLETION_PATHS`: it is test-only and not a contract.
- **Stable-contract paragraph:**
  - narrow "non-zero exit on any failure" to "non-zero exit on any failure of the client or `vault` install";
  - say that the bash completion step only warns on failure;
  - list `KERGHAN_COMPLETION` among the variables that can only grow backward-compatibly.

  Keep the rest of the paragraph's wording.
- **Summary paragraph:** add a sentence. It installs bash completion to `${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan`, from the output of the client it just installed, refreshed on every run, unless `KERGHAN_COMPLETION=false`.
- Keep "It never uses sudo and never touches ~/.kerghan or any Docker volume" and the bash 3.2 / self-contained sentence.

## Files to Change
- `standalone/install.sh` — header comment only.
