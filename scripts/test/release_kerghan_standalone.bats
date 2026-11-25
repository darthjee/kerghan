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

@test "single-platform manifest: pulls its own digest and tags the -arm64 image" {
  export STUB_ARCH=arm64
  run save_image arm64 darthjee/tent:1.0.3-arm64 tent
  [ "$status" -eq 0 ]
  assert_logged "docker pull darthjee/tent@$D4"
  assert_logged "docker tag darthjee/tent@$D4 darthjee/tent:1.0.3-arm64"
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
