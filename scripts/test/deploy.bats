#!/usr/bin/env bats
# scripts/deploy.sh: CI deploy of a release tag on Render. The service is Git-backed:
# the branch is moved to the tag, then Render builds the thin
# dockerfiles/production_kerghan/Dockerfile (FROM darthjee/kerghan:<tag>).

bats_require_minimum_version 1.5.0
load helpers/setup

@test "deploy on the latest tag moves the branch, deploys and waits for live" {
  write_dockerfile 1.2.3
  export CIRCLE_TAG=1.2.3 STUB_GIT_TAGS="1.2.2 1.2.3" STUB_GIT_DESCRIBE=1.2.3
  export STUB_DEPLOY_STATUSES="build_in_progress update_in_progress live"
  run "$DEPLOY" deploy
  [ "$status" -eq 0 ]
  assert_logged "$(branch_patch 1.2.3)"
  assert_logged "$(deploy_post)"
  assert_output_contains "DEPLOYMENT STATUS live"
  [ "$(grep -c '^curl GET .*/deploys/dep-1 $' "$STUB_LOG")" -eq 3 ]
}

@test "the branch is moved before the deploy is requested" {
  write_dockerfile 1.2.3
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 0 ]
  patch_line=$(grep -nxF -- "$(branch_patch 1.2.3)" "$STUB_LOG" | cut -d: -f1)
  post_line=$(grep -nxF -- "$(deploy_post)" "$STUB_LOG" | cut -d: -f1)
  [ -n "$patch_line" ]
  [ -n "$post_line" ]
  [ "$patch_line" -lt "$post_line" ]
}

@test "deploy is skipped when the commit is not the latest tag" {
  write_dockerfile 1.2.3
  export CIRCLE_TAG=1.2.3 STUB_GIT_TAGS="1.2.3" STUB_GIT_DESCRIBE=1.2.3-2-gabcdef
  run "$DEPLOY" deploy
  [ "$status" -eq 0 ]
  assert_output_contains "Not last commit"
  refute_logged_prefix "curl"
}

@test "a Dockerfile version mismatch fails without calling the Render API" {
  write_dockerfile 1.2.2
  export CIRCLE_TAG=1.2.3 STUB_GIT_TAGS="1.2.3" STUB_GIT_DESCRIBE=1.2.3
  run "$DEPLOY" deploy
  [ "$status" -eq 1 ]
  assert_output_contains "dockerfile version mismatch"
  assert_output_contains "1.2.2"
  assert_output_contains "1.2.3"
  refute_logged_prefix "curl"
}

@test "a Dockerfile without a darthjee/kerghan FROM line fails without calling the Render API" {
  printf 'FROM darthjee/other:1.2.3\n' >"$RENDER_DOCKERFILE"
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "dockerfile version mismatch"
  refute_logged_prefix "curl"
}

@test "a missing Dockerfile fails without calling the Render API" {
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "dockerfile version mismatch"
  refute_logged_prefix "curl"
}

@test "deploy without CIRCLE_TAG is rejected without calling the Render API" {
  write_dockerfile 1.2.3
  export STUB_GIT_TAGS="1.2.3" STUB_GIT_DESCRIBE=1.2.3
  run "$DEPLOY" deploy
  [ "$status" -eq 1 ]
  assert_output_contains "a release tag is required"
  refute_logged_prefix "curl"
}

@test "an unknown RENDER_SERVICE_NAME exits non-zero without moving the branch or deploying" {
  write_dockerfile 1.2.3
  export RENDER_SERVICE_NAME=missing
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "render service not found: missing"
  refute_logged_prefix "curl PATCH"
  refute_logged_prefix "curl POST"
}

@test "a rejected branch update exits non-zero without deploying" {
  write_dockerfile 1.2.3
  export STUB_PATCH_FAIL=1
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "branch update failed"
  refute_logged_prefix "curl POST"
}

@test "a rejected deploy request exits non-zero without watching" {
  write_dockerfile 1.2.3
  export STUB_DEPLOY_FAIL=1
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "deploy request failed"
  refute_logged_prefix "curl GET https://api.render.com/v1/services/srv-123/deploys/"
}

@test "a deploy response without an id exits non-zero without watching" {
  write_dockerfile 1.2.3
  export STUB_DEPLOY_RESPONSE='{}'
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "returned no deploy id"
  refute_logged_prefix "curl GET https://api.render.com/v1/services/srv-123/deploys/"
}

@test "a deployment that never goes live times out non-zero" {
  write_dockerfile 1.2.3
  export STUB_DEPLOY_STATUSES="update_in_progress"
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "timed out"
}

@test "watch follows the last deployment until live" {
  export STUB_GIT_TAGS="1.2.3" STUB_GIT_DESCRIBE=1.2.3
  run "$DEPLOY" watch
  [ "$status" -eq 0 ]
  assert_logged "curl GET https://api.render.com/v1/services/srv-123/deploys?limit=1 "
  assert_output_contains "DEPLOYMENT STATUS live"
}

@test "a build_failed deployment exits non-zero" {
  write_dockerfile 1.2.3
  export STUB_DEPLOY_STATUSES="build_in_progress build_failed"
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "DEPLOYMENT STATUS build_failed"
}

@test "a update_failed deployment exits non-zero" {
  write_dockerfile 1.2.3
  export STUB_DEPLOY_STATUSES="build_in_progress update_failed"
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "DEPLOYMENT STATUS update_failed"
}

@test "a pre_deploy_failed deployment exits non-zero" {
  write_dockerfile 1.2.3
  export STUB_DEPLOY_STATUSES="build_in_progress pre_deploy_failed"
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "DEPLOYMENT STATUS pre_deploy_failed"
}

@test "a canceled deployment exits non-zero" {
  write_dockerfile 1.2.3
  export STUB_DEPLOY_STATUSES="build_in_progress canceled"
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "DEPLOYMENT STATUS canceled"
}

@test "a deactivated deployment exits non-zero" {
  write_dockerfile 1.2.3
  export STUB_DEPLOY_STATUSES="build_in_progress deactivated"
  run "$DEPLOY" force_deploy 1.2.3
  [ "$status" -eq 1 ]
  assert_output_contains "DEPLOYMENT STATUS deactivated"
}
