# Standalone: client completion (`kerghan completion bash`)

Part of [Standalone Distribution](../standalone.md). This is the hub for bash tab completion in the standalone `kerghan` client. The feature is defined by epic #424; implementation lives in `standalone/bin/kerghan` and `standalone/install.sh`.

The client prints its built-in completion script with `kerghan completion bash`; `install.sh` installs that script for bash-completion's lazy loading. Bash 3.2 is supported. The completion is static, does no work beyond bash while completing, and never reads config or env files.

## Guides

- [`kerghan completion <shell>`](client-completion/command.md) — usage, output streams, errors, messages and command tests.
- [Completion behavior](client-completion/behavior.md) — candidates by command and position, `configure` keys and values, exclusions, edge cases and the completion matrix.
- [Installer setup](client-completion/installer.md) — destination, content, detection and hint, opt-out, failures, update behavior and installer tests.
- [Performance, security and stable contracts](client-completion/security-contracts.md) — shell hygiene, trust boundary, stable interfaces, sync rule and safety/contract tests.
- [Testing](client-completion/testing.md) — harness, fresh-shell checks, bash 3.2 service, file layout and coverage conventions.

## Overview and scope

Bash completion is the supported shell (including bash 3.2 on macOS). zsh and fish, network-backed version suggestions, Docker Compose passthrough completion, dynamic lookups and Windows/PowerShell are out of scope. See the [command and scope guide](client-completion/command.md#overview-and-scope) and [behavior guide](client-completion/behavior.md).

## `kerghan completion <shell>`

The command's shape, streams, usage errors and no-side-effect guarantees are in the [command guide](client-completion/command.md).

### Shape

See [command shape and invocation](client-completion/command.md#kerghan-completion-shell).

### Output and streams

See [command output and streams](client-completion/command.md#output-and-streams).

### Error cases

See [error cases and messages](client-completion/command.md#error-cases-and-messages).

### Messages and exit codes

See [the exact usage line and error messages](client-completion/command.md#error-cases-and-messages).

### No side effects

See the [command's no-side-effect guarantees](client-completion/command.md#no-side-effects).

### Required tests

See [command tests](client-completion/command.md#required-tests).

## What is completed

Candidate behavior, per-position rules, fixed and free-form `configure` values, exclusions and edge cases are specified in the [completion behavior guide](client-completion/behavior.md).

### Registration

See [registration and spacing](client-completion/behavior.md#registration-and-spacing).

### Per-position table

See the [per-position table](client-completion/behavior.md#per-position-table).

### Never completed

See [words intentionally not completed](client-completion/behavior.md#never-completed).

### Edge cases

See [completion edge cases](client-completion/behavior.md#edge-cases).

## Installer setup

The `install.sh` completion step and its user-facing behavior are specified in the [installer guide](client-completion/installer.md).

### Never fatal

See [non-fatal failure handling](client-completion/installer.md#non-fatal-failure-handling).

### Opt-out

See [installer opt-out](client-completion/installer.md#opt-out).

## Performance and security

See [performance, security and stable contracts](client-completion/security-contracts.md#performance-and-security).

## Stable contracts

The stable interfaces are in the [contracts guide](client-completion/security-contracts.md#stable-contracts).

### Sync rule

Any PR that changes a client command, flag, `configure` key or fixed value updates completion in the same PR. The [sync rule](client-completion/security-contracts.md#sync-rule) is enforced by `standalone/test/completion_sync.bats` and is part of the [Definition of Done for PRs](../contributing.md#definition-of-done-for-prs).

## Testing

Test design and suite setup are in the [testing guide](client-completion/testing.md).

### bash 3.2

The full standalone suite runs on bash 5 and bash 3.2; see the [bash 3.2 test setup](client-completion/testing.md#bash-32).
