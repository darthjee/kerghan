# Repoint code comments

These comments link into the spec folder. Point each one at the matching section of `docs/agents/standalone/client-completion.md`. Edit comments only: no code, test logic or CI step changes.

| File | Current reference | New reference |
|------|-------------------|---------------|
| `standalone/bin/kerghan` (~line 28) | `docs/agents/specs/auto-complete/contracts.md` | `docs/agents/standalone/client-completion.md#stable-contracts` |
| `standalone/bin/kerghan` (~line 1814) | `docs/agents/specs/auto-complete/` | `docs/agents/standalone/client-completion.md` (performance and security) |
| `standalone/test/completion.bats` (line 4) | `…/completion.md` | the page's "What is completed" section |
| `standalone/test/completion_command.bats` (line 4) | `command.md, contracts.md, security.md` | the page's command, contracts and security sections |
| `standalone/test/completion_safety.bats` (line 4) | `…/security.md` | the page's security section |
| `standalone/test/completion_sync.bats` (line 3) | `…/completion.md, contracts.md` | the page's word lists and sync-rule sections |
| `standalone/test/install_completion.bats` (line 4) | `…/install.md#required-tests` | the page's installer required tests |
| `standalone/test/helpers/completion.bash` (line 2) | `auto-complete/README.md, "Testing"` | the page's "Testing" section |
| `dockerfiles/bats_bash32/Dockerfile` (line 2) | `…/README.md#bash-32` | the page's bash 3.2 testing anchor |
| `.circleci/config.yml` (~line 227) | `…/README.md#bash-32` | the same anchor |

- Keep line lengths close to the current wrapping, so the diff stays small.
- Use the anchors that step 01 actually produced.
- Afterwards, run `docker-compose run --rm standalone_tests` and `docker-compose run --rm bats_bash32` through docker-compose (never on the host) to confirm nothing changed.

## Files to Change

- `standalone/bin/kerghan`: two comment links.
- `standalone/test/completion.bats`, `completion_command.bats`, `completion_safety.bats`, `completion_sync.bats` and `install_completion.bats`: header comment links.
- `standalone/test/helpers/completion.bash`: header comment link.
- `dockerfiles/bats_bash32/Dockerfile`: comment link.
- `.circleci/config.yml`: comment link.
