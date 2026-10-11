#!/usr/bin/env bats
# scripts/deploy.sh: CI deploy and rollback of the darthjee/kerghan image on Render.

bats_require_minimum_version 1.5.0
load helpers/setup

@test "deploy on a tag deploys docker.io/darthjee/kerghan:<tag> and waits for live" {
  export CIRCLE_TAG=1.2.3 STUB_GIT_TAGS="1.2.2 1.2.3" STUB_GIT_DESCRIBE=1.2.3
  export STUB_DEPLOY_STATUSES="build_in_progress update_in_progress live"
  run "$DEPLOY" deploy
  [ "$status" -eq 0 ]
  assert_logged "$(deploy_post 1.2.3)"
  assert_output_contains "DEPLOYMENT STATUS live"
  [ "$(grep -c '^curl GET .*/deploys/dep-1 $' "$STUB_LOG")" -eq 3 ]
}

@test "deploy is skipped when the commit is not the latest tag" {
  export CIRCLE_TAG=1.2.3 STUB_GIT_TAGS="1.2.3" STUB_GIT_DESCRIBE=1.2.3-2-gabcdef
  run "$DEPLOY" deploy
  [ "$status" -eq 0 ]
  assert_output_contains "Not last commit"
  refute_logged_prefix "curl"
}

@test "deploy_image deploys an arbitrary (rollback) tag and waits for live" {
  run "$DEPLOY" deploy_image 1.0.0
  [ "$status" -eq 0 ]
  assert_logged "$(deploy_post 1.0.0)"
  assert_output_contains "DEPLOYMENT STATUS live"
  refute_logged_prefix "git"
}

@test "an unknown RENDER_SERVICE_NAME exits non-zero without deploying" {
  export RENDER_SERVICE_NAME=missing
  run "$DEPLOY" deploy_image 1.0.0
  [ "$status" -eq 1 ]
  assert_output_contains "render service not found: missing"
  refute_logged_prefix "curl POST"
}

@test "no call ever changes the service branch or source" {
  export CIRCLE_TAG=1.2.3 STUB_GIT_TAGS="1.2.3" STUB_GIT_DESCRIBE=1.2.3
  run "$DEPLOY" deploy
  [ "$status" -eq 0 ]
  run "$DEPLOY" deploy_image 1.0.0
  [ "$status" -eq 0 ]
  refute_logged_prefix "curl PATCH"
  refute_logged_prefix "curl PUT"
}

@test "update_deploy_branch no longer exists" {
  export CIRCLE_TAG=1.2.3
  run -127 "$DEPLOY" update_deploy_branch
  [ "$status" -eq 127 ]
  refute_logged_prefix "curl"
}

@test "an empty tag is rejected without calling the Render API" {
  run "$DEPLOY" deploy_image
  [ "$status" -eq 1 ]
  assert_output_contains "invalid image tag"
  refute_logged_prefix "curl"
}

@test "latest is rejected without calling the Render API" {
  run "$DEPLOY" deploy_image latest
  [ "$status" -eq 1 ]
  assert_output_contains "invalid image tag"
  refute_logged_prefix "curl"
}

@test "deploy without CIRCLE_TAG is rejected without calling the Render API" {
  export STUB_GIT_TAGS="1.2.3" STUB_GIT_DESCRIBE=1.2.3
  run "$DEPLOY" deploy
  [ "$status" -eq 1 ]
  refute_logged_prefix "curl"
}

@test "a rejected deploy request exits non-zero without watching" {
  export STUB_DEPLOY_FAIL=1
  run "$DEPLOY" deploy_image 1.0.0
  [ "$status" -eq 1 ]
  assert_output_contains "deploy request failed"
  refute_logged_prefix "curl GET https://api.render.com/v1/services/srv-123/deploys/"
}

@test "a deploy response without an id exits non-zero without watching" {
  export STUB_DEPLOY_RESPONSE='{}'
  run "$DEPLOY" deploy_image 1.0.0
  [ "$status" -eq 1 ]
  assert_output_contains "returned no deploy id"
  refute_logged_prefix "curl GET https://api.render.com/v1/services/srv-123/deploys/"
}

@test "a deployment that never goes live times out non-zero" {
  export STUB_DEPLOY_STATUSES="update_in_progress"
  run "$DEPLOY" deploy_image 1.0.0
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
  export STUB_DEPLOY_STATUSES="build_in_progress build_failed"
  run "$DEPLOY" deploy_image 1.0.0
  [ "$status" -eq 1 ]
  assert_output_contains "DEPLOYMENT STATUS build_failed"
}

@test "a update_failed deployment exits non-zero" {
  export STUB_DEPLOY_STATUSES="build_in_progress update_failed"
  run "$DEPLOY" deploy_image 1.0.0
  [ "$status" -eq 1 ]
  assert_output_contains "DEPLOYMENT STATUS update_failed"
}

@test "a pre_deploy_failed deployment exits non-zero" {
  export STUB_DEPLOY_STATUSES="build_in_progress pre_deploy_failed"
  run "$DEPLOY" deploy_image 1.0.0
  [ "$status" -eq 1 ]
  assert_output_contains "DEPLOYMENT STATUS pre_deploy_failed"
}

@test "a canceled deployment exits non-zero" {
  export STUB_DEPLOY_STATUSES="build_in_progress canceled"
  run "$DEPLOY" deploy_image 1.0.0
  [ "$status" -eq 1 ]
  assert_output_contains "DEPLOYMENT STATUS canceled"
}

@test "a deactivated deployment exits non-zero" {
  export STUB_DEPLOY_STATUSES="build_in_progress deactivated"
  run "$DEPLOY" deploy_image 1.0.0
  [ "$status" -eq 1 ]
  assert_output_contains "DEPLOYMENT STATUS deactivated"
}
