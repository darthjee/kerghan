#!/usr/bin/env bats
# The installer's bash completion step (standalone/install.sh): target path,
# content, messages, never-fatal failures, safety and the `update` contract.
# Spec: docs/agents/standalone/client-completion.md#installer-setup
# ("Required tests"). Runs on bash 5 and bash 3.2, like the whole suite;
# the bats containers run as root, so failures are injected (a regular
# file in the path, a failing mv) rather than made with chmod.

bats_require_minimum_version 1.5.0

load helpers/install_setup

HINT_LINE="kerghan-install: hint: bash-completion was not found; to enable completion, add this to ~/.bashrc:"

# run_installer_split - runs install.sh like run_installer, with stderr in
# $stderr instead of merged into $output.
run_installer_split() {
  run --separate-stderr env PATH="$INSTALL_PATH" "$INSTALLER"
}

# success_line [file]
success_line() {
  echo "kerghan-install: bash completion installed to ${1:-$COMPLETION_FILE}"
}

# source_line [file]
source_line() {
  echo "  source \"${1:-$COMPLETION_FILE}\""
}

# client_warning - the warning for a client that fails to print the script.
client_warning() {
  echo "kerghan-install: warning: $DEFAULT_DIR/kerghan completion bash failed; skipping bash completion"
}

# write_warning [file]
write_warning() {
  echo "kerghan-install: warning: could not write ${1:-$COMPLETION_FILE}; skipping bash completion"
}

# assert_line_count <exact line> <count> - <exact line> appears <count> times
# in $output.
assert_line_count() {
  local line found=0
  for line in "${lines[@]}"; do
    if [ "$line" = "$1" ]; then
      found=$((found + 1))
    fi
  done
  if [ "$found" -ne "$2" ]; then
    echo "expected $2 line(s) '$1', found $found" >&2
    echo "--- output ---" >&2
    echo "$output" >&2
    return 1
  fi
}

# assert_never_fatal <warning line> - exit 0, the client installed, exactly
# one warning line, no success line and no hint.
assert_never_fatal() {
  [ "$status" -eq 0 ]
  [ -x "$DEFAULT_DIR/kerghan" ]
  assert_line_count "$1" 1
  refute_output_contains "bash completion installed to"
  refute_output_contains "$HINT_LINE"
  refute_output_contains "source \""
  assert_staging_cleaned
}

# assert_no_temp_file <dir> - no .kerghan.* temp file left in <dir>.
assert_no_temp_file() {
  local f
  for f in "$1"/.kerghan.*; do
    if [ -e "$f" ] || [ -L "$f" ]; then
      echo "temp file left behind: $f" >&2
      return 1
    fi
  done
}

# refute_file_contains <text> - COMPLETION_FILE does not contain <text>.
refute_file_contains() {
  if grep -qF -- "$1" "$COMPLETION_FILE"; then
    echo "unexpected '$1' in $COMPLETION_FILE" >&2
    return 1
  fi
}

# hand_written_file - an existing completion file with known content.
hand_written_file() {
  mkdir -p "${COMPLETION_FILE%/*}"
  echo "# hand-written" >"$COMPLETION_FILE"
}

# --- Target and content ---

@test "target: BASH_COMPLETION_USER_DIR wins over XDG_DATA_HOME" {
  with_vault
  export BASH_COMPLETION_USER_DIR="$TEST_ROOT/bc-user"
  export XDG_DATA_HOME="$TEST_ROOT/xdg"
  run_installer
  [ "$status" -eq 0 ]
  assert_completion_file "$BASH_COMPLETION_USER_DIR/completions/kerghan"
  [ ! -e "$XDG_DATA_HOME" ]
  [ ! -e "$COMPLETION_FILE" ]
  assert_output_contains "$(success_line "$BASH_COMPLETION_USER_DIR/completions/kerghan")"
}

@test "target: XDG_DATA_HOME alone sets the directory" {
  with_vault
  export XDG_DATA_HOME="$TEST_ROOT/xdg"
  run_installer
  [ "$status" -eq 0 ]
  assert_completion_file "$XDG_DATA_HOME/bash-completion/completions/kerghan"
  [ ! -e "$COMPLETION_FILE" ]
  assert_output_contains "$(success_line "$XDG_DATA_HOME/bash-completion/completions/kerghan")"
}

@test "contract file path: defaults to ~/.local/share/bash-completion/completions/kerghan" {
  with_vault
  run_installer
  [ "$status" -eq 0 ]
  assert_completion_file "$HOME/.local/share/bash-completion/completions/kerghan"
}

@test "target: directory created when missing" {
  with_vault
  [ ! -e "$HOME/.local/share" ]
  run_installer
  [ "$status" -eq 0 ]
  [ -d "${COMPLETION_FILE%/*}" ]
  assert_completion_file
}

@test "exact binary: the file holds the installed client's output, not a kerghan on PATH" {
  with_vault
  printf '#!/usr/bin/env bash\necho "stub on PATH"\n' >"$STUB_BIN/kerghan"
  chmod +x "$STUB_BIN/kerghan"
  run_installer
  [ "$status" -eq 0 ]
  assert_completion_file
  refute_file_contains "stub on PATH"
}

@test "overwrite: a hand-written file is replaced by the client's output" {
  with_vault
  hand_written_file
  run_installer
  [ "$status" -eq 0 ]
  assert_completion_file
  refute_file_contains "# hand-written"
}

@test "contract KERGHAN_COMPLETION=false: creates nothing and prints nothing about completion" {
  with_vault
  export KERGHAN_COMPLETION=false
  run_installer_split
  [ "$status" -eq 0 ]
  [ -x "$DEFAULT_DIR/kerghan" ]
  [ ! -e "$COMPLETION_FILE" ]
  [ ! -e "$HOME/.local/share" ]
  refute_output_contains "completion"
  case "$stderr" in
    *completion*)
      echo "unexpected completion message on stderr: $stderr" >&2
      return 1
      ;;
  esac
}

# --- Messages ---

@test "success line: on stdout, after the installed line and before check_path's output" {
  with_vault
  run_installer
  [ "$status" -eq 0 ]
  local i installed=-1 success=-1 path_warning=-1
  for i in "${!lines[@]}"; do
    case "${lines[$i]}" in
      "kerghan-install: kerghan $CURRENT_VERSION installed to $DEFAULT_DIR/kerghan") installed=$i ;;
      "$(success_line)") success=$i ;;
      "kerghan-install: warning: $DEFAULT_DIR is not on your PATH") path_warning=$i ;;
    esac
  done
  [ "$installed" -ge 0 ]
  [ "$success" -eq $((installed + 1)) ]
  [ "$path_warning" -gt "$success" ]

  run_installer_split
  [ "$status" -eq 0 ]
  assert_output_contains "$(success_line)"
}

@test "hint printed: bash-completion not detected prints both lines on stderr" {
  with_vault
  run_installer_split
  [ "$status" -eq 0 ]
  assert_completion_file
  case "$stderr" in
    *"$HINT_LINE"$'\n'"$(source_line)"*) ;;
    *)
      echo "expected the hint and source lines on stderr" >&2
      echo "--- stderr ---" >&2
      echo "$stderr" >&2
      return 1
      ;;
  esac
  refute_output_contains "$HINT_LINE"
}

@test "no hint: bash-completion detected prints no hint" {
  with_vault
  : >"$TEST_ROOT/bash_completion"
  export KERGHAN_BASH_COMPLETION_PATHS="$TEST_ROOT/missing $TEST_ROOT/bash_completion"
  run_installer
  [ "$status" -eq 0 ]
  assert_completion_file
  assert_output_contains "$(success_line)"
  refute_output_contains "bash-completion was not found"
  refute_output_contains "source \""
}

# --- Never fatal ---

@test "failure: mkdir warns and the install exits 0" {
  with_vault
  : >"$TEST_ROOT/a-file"
  export BASH_COMPLETION_USER_DIR="$TEST_ROOT/a-file/bc"
  run_installer
  assert_never_fatal "kerghan-install: warning: could not create $TEST_ROOT/a-file/bc/completions; skipping bash completion"
}

@test "failure: client exits non-zero leaves the existing file untouched" {
  with_vault
  hand_written_file
  export STUB_CLIENT_COMPLETION=missing
  run_installer
  assert_never_fatal "$(client_warning)"
  [ "$(cat "$COMPLETION_FILE")" = "# hand-written" ]
  assert_no_temp_file "${COMPLETION_FILE%/*}"
}

@test "failure: client prints nothing leaves the existing file untouched" {
  with_vault
  hand_written_file
  export STUB_CLIENT_COMPLETION=empty
  run_installer
  assert_never_fatal "$(client_warning)"
  [ "$(cat "$COMPLETION_FILE")" = "# hand-written" ]
  assert_no_temp_file "${COMPLETION_FILE%/*}"
}

@test "failure: write warns and leaves no temp file" {
  with_vault
  hand_written_file
  with_failing_completion_mv
  run_installer
  assert_never_fatal "$(write_warning)"
  [ "$(cat "$COMPLETION_FILE")" = "# hand-written" ]
  assert_no_temp_file "${COMPLETION_FILE%/*}"
}

# --- Safety ---

@test "temp file in the target directory: written there, then only kerghan remains" {
  with_vault
  export STUB_CLIENT_COMPLETION=list
  export STUB_COMPLETION_DIR="${COMPLETION_FILE%/*}"
  run_installer
  [ "$status" -eq 0 ]
  assert_completion_file
  local entries=() line
  while IFS= read -r line; do
    case "$line" in
      "# entry "*) entries+=("${line#\# entry }") ;;
    esac
  done <"$COMPLETION_FILE"
  [ "${#entries[@]}" -eq 1 ]
  case "${entries[0]}" in
    .kerghan.?*) ;;
    *)
      echo "expected a .kerghan.* temp file, listed: ${entries[*]}" >&2
      return 1
      ;;
  esac
  local f remaining=()
  for f in "$STUB_COMPLETION_DIR"/.* "$STUB_COMPLETION_DIR"/*; do
    case "${f##*/}" in
      . | .. | "*" | ".*") continue ;;
    esac
    remaining+=("${f##*/}")
  done
  [ "${remaining[*]}" = "kerghan" ]
}

@test "symlink replaced: the target becomes a regular file, the old target is unchanged" {
  with_vault
  echo "# pointed at" >"$TEST_ROOT/other"
  mkdir -p "${COMPLETION_FILE%/*}"
  ln -s "$TEST_ROOT/other" "$COMPLETION_FILE"
  run_installer
  [ "$status" -eq 0 ]
  [ ! -L "$COMPLETION_FILE" ]
  assert_completion_file
  [ "$(cat "$TEST_ROOT/other")" = "# pointed at" ]
}

@test "not executable: the completion file has no execute bit" {
  with_vault
  run_installer
  [ "$status" -eq 0 ]
  assert_completion_file
  [ ! -x "$COMPLETION_FILE" ]
}

# --- update contract ---

@test "contract update: no prompt, no sudo, nothing under ~/.kerghan" {
  with_vault
  printf '#!/usr/bin/env bash\necho "sudo $*" >>"$STUB_LOG"\n' >"$STUB_BIN/sudo"
  chmod +x "$STUB_BIN/sudo"
  run env PATH="$INSTALL_PATH" "$INSTALLER" <&-
  [ "$status" -eq 0 ]
  assert_completion_file
  refute_logged_prefix "sudo"
  [ ! -e "$HOME/.kerghan" ]
}

@test "contract update: exit unchanged when the completion step fails" {
  with_vault
  with_failing_completion_mv
  run_installer
  local failed_status="$status" failed_output="" line
  for line in "${lines[@]}"; do
    if [ "$line" != "$(write_warning)" ]; then
      failed_output+="$line"$'\n'
    fi
  done
  assert_line_count "$(write_warning)" 1

  export KERGHAN_COMPLETION=false
  run_installer
  local skipped_output=""
  for line in "${lines[@]}"; do
    skipped_output+="$line"$'\n'
  done

  [ "$failed_status" -eq "$status" ]
  [ "$failed_output" = "$skipped_output" ]
}
