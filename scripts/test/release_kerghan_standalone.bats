#!/usr/bin/env bats
# bin/release_kerghan_standalone.sh: save_image pulls the per-arch manifest by digest.

bats_require_minimum_version 1.5.0
load helpers/release_standalone

D1=sha256:1111111111111111111111111111111111111111111111111111111111111111
D2=sha256:2222222222222222222222222222222222222222222222222222222222222222
D3=sha256:3333333333333333333333333333333333333333333333333333333333333333
D4=sha256:4444444444444444444444444444444444444444444444444444444444444444
D5=sha256:5555555555555555555555555555555555555555555555555555555555555555

@test "index, arm64: pulls the arm64 digest, tags and saves" {
  export STUB_ARCH=arm64
  run save_image arm64 darthjee/kerghan:1.2.3 kerghan
  [ "$status" -eq 0 ]
  assert_logged "docker pull darthjee/kerghan@$D2"
  assert_logged "docker tag darthjee/kerghan@$D2 darthjee/kerghan:1.2.3"
  assert_logged "docker save darthjee/kerghan:1.2.3 -o $IMAGES_DIR/arm64/kerghan.tar"
}

@test "index, amd64: pulls the amd64 digest" {
  export STUB_ARCH=amd64
  run save_image amd64 darthjee/kerghan:1.2.3 kerghan
  [ "$status" -eq 0 ]
  assert_logged "docker pull darthjee/kerghan@$D1"
}

@test "mysql-like index: picks the arm64 v8 digest, never an attestation" {
  export STUB_ARCH=arm64
  run save_image arm64 mysql:8.4.11 mysql
  [ "$status" -eq 0 ]
  assert_logged "docker pull mysql@$D3"
  refute_logged_prefix "docker pull mysql@$D4"
  refute_logged_prefix "docker pull mysql@$D5"
}

@test "docker cli index: picks each arch digest and saves docker-cli.tar" {
  export STUB_ARCH=arm64
  run save_image arm64 docker:27.5.1-cli docker-cli
  [ "$status" -eq 0 ]
  assert_logged "docker pull docker@$D3"
  assert_logged "docker tag docker@$D3 docker:27.5.1-cli"
  assert_logged "docker save docker:27.5.1-cli -o $IMAGES_DIR/arm64/docker-cli.tar"
  refute_logged_prefix "docker pull docker@$D4"
}

@test "docker cli index, amd64: pulls the amd64 digest" {
  export STUB_ARCH=amd64
  run save_image amd64 docker:27.5.1-cli docker-cli
  [ "$status" -eq 0 ]
  assert_logged "docker pull docker@$D1"
}

@test "tent index, arm64: pulls the arm64 digest, re-tags and saves tent.tar" {
  export STUB_ARCH=arm64
  run save_image arm64 darthjee/tent:9.9.9 tent
  [ "$status" -eq 0 ]
  assert_logged "docker pull darthjee/tent@$D4"
  assert_logged "docker tag darthjee/tent@$D4 darthjee/tent:9.9.9"
  assert_logged "docker save darthjee/tent:9.9.9 -o $IMAGES_DIR/arm64/tent.tar"
}

@test "single-platform manifest: pulls its own digest" {
  export STUB_ARCH=arm64
  run save_image arm64 single_platform:1.0 x
  [ "$status" -eq 0 ]
  assert_logged "docker pull single_platform@$D5"
  assert_logged "docker tag single_platform@$D5 single_platform:1.0"
}

@test "require_platform_manifest: passes on a multi-arch tag for both arches" {
  run require_platform_manifest amd64 darthjee/tent:9.9.9
  [ "$status" -eq 0 ]
  [ -z "$output" ]
  run require_platform_manifest arm64 darthjee/tent:9.9.9
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "require_platform_manifest: aborts when the tag lacks the arch" {
  run require_platform_manifest arm64 only_amd64:1.0
  [ "$status" -eq 1 ]
  [ "$output" = "only_amd64:1.0 has no linux/arm64 manifest; Tent must be published as a multi-arch tag." ]
  refute_logged_prefix "docker pull"
}

@test "require_platform_manifest: aborts on a single-platform tag (not an index)" {
  for arch in amd64 arm64; do
    run require_platform_manifest "$arch" single_platform:1.0
    [ "$status" -eq 1 ]
    [ "$output" = "single_platform:1.0 has no linux/$arch manifest; Tent must be published as a multi-arch tag." ]
  done
  refute_logged_prefix "docker pull"
}

@test "require_platform_manifest: a missing tag fails with the inspect error only" {
  run require_platform_manifest arm64 missing:1.0
  [ "$status" -eq 1 ]
  [[ "$output" == *"no fixture"* ]]
  [[ "$output" != *"must be published as a multi-arch tag"* ]]
}

@test "save_images: saves the one Tent tag for each architecture" {
  save_image() { echo "save_image $*" >>"$STUB_LOG"; }
  TENT_IMAGE=darthjee/tent:9.9.9
  run save_images 1.2.3
  [ "$status" -eq 0 ]
  assert_logged "save_image amd64 darthjee/tent:9.9.9 tent"
  assert_logged "save_image arm64 darthjee/tent:9.9.9 tent"
}

@test "save_images: the guard stops before saving a Tent tag lacking the arch" {
  save_image() { echo "save_image $*" >>"$STUB_LOG"; }
  TENT_IMAGE=only_amd64:1.0
  run save_images 1.2.3
  [ "$status" -eq 1 ]
  [[ "$output" == *"only_amd64:1.0 has no linux/arm64 manifest; Tent must be published"* ]]
  assert_logged "save_image amd64 only_amd64:1.0 tent"
  refute_logged_prefix "save_image arm64 only_amd64:1.0"
}

# in_version_dir <version file content> <bash code> - runs <bash code> in a fresh
# shell that sourced the release script from a directory holding that `version`.
in_version_dir() {
  printf '%s' "$1" >"$TEST_ROOT/version"
  run bash -c 'cd "$1" && source "$2" && eval "$3"' _ "$TEST_ROOT" "$RELEASE_SCRIPT" "$2"
}

@test "TENT_IMAGE comes from the tent= line of the version file" {
  in_version_dir $'kerghan-base=0.1.2\ntent=9.9.9\n' 'echo "$TENT_IMAGE"'
  [ "$status" -eq 0 ]
  [ "$output" = "darthjee/tent:9.9.9" ]
}

@test "an empty tent= entry aborts the release before any docker call" {
  in_version_dir $'tent=\n' 'CIRCLE_TAG=1.2.3 release'
  [ "$status" -eq 1 ]
  [[ "$output" == *"version file has no tent= entry"* ]]
  refute_logged_prefix "docker"
}

@test "a missing tent= entry aborts the release before any docker call" {
  in_version_dir $'kerghan-base=0.1.2\n' 'CIRCLE_TAG=1.2.3 release'
  [ "$status" -eq 1 ]
  [[ "$output" == *"version file has no tent= entry"* ]]
  refute_logged_prefix "docker"
}

@test "no linux/arm64 entry: fails without pulling or saving" {
  run save_image arm64 only_amd64:1.0 x
  [ "$status" -eq 1 ]
  [[ "$output" == *"has no linux/arm64 manifest"* ]]
  refute_logged_prefix "docker pull"
  refute_logged_prefix "docker save"
}

@test "two matching entries: fails without pulling" {
  run save_image arm64 dup_arm64:1.0 x
  [ "$status" -eq 1 ]
  [[ "$output" == *"has several linux/arm64 manifests"* ]]
  refute_logged_prefix "docker pull"
}

@test "wrong local architecture: fails without saving" {
  export STUB_ARCH=amd64
  run save_image arm64 darthjee/kerghan:1.2.3 kerghan
  [ "$status" -eq 1 ]
  [[ "$output" == *"is amd64, expected arm64."* ]]
  refute_logged_prefix "docker save"
}

@test "sourcing runs nothing; executing with an unknown action prints usage" {
  [ ! -s "$STUB_LOG" ]
  run bash "$RELEASE_SCRIPT" bogus
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage:"* ]]
}
