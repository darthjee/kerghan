#!/usr/bin/env bash

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER_DOCKERFILE="${RENDER_DOCKERFILE:-$SCRIPTS_DIR/../dockerfiles/production_kerghan/Dockerfile}"

source "$SCRIPTS_DIR/render.sh"

function isLatestCommit() {
  VERSION=$(git tag | grep $(git describe  --tags))

  if [[ $VERSION ]]; then
    return 0
  else
    return 1
  fi
}

function checkLastVersion() {
  if $(isLatestCommit); then
    echo "latest commit";
  else
    echo "Not last commit"
    exit 0
  fi
}

function check_deployment_status() {
  SERVICE_ID=$1
  DEPLOYMENT_ID=$2
  STATUS=$(deployment_status "$SERVICE_ID" "$DEPLOYMENT_ID")
  echo "DEPLOYMENT STATUS $STATUS"

  if [ "$STATUS" == "live" ]; then
    exit 0;
  elif [ "$STATUS" == "build_failed" ] ||
    [ "$STATUS" == "update_failed" ] ||
    [ "$STATUS" == "pre_deploy_failed" ] ||
    [ "$STATUS" == "canceled" ] ||
    [ "$STATUS" == "deactivated" ]; then
    exit 1;
  else
    return 0;
  fi
}

function watch_deployment() {
  SERVICE_ID=$1
  DEPLOYMENT_ID=$2

  WAIT_TIME=160

  for COUNT in {1..20}; do
    echo "ATTEMPT $COUNT"
    check_deployment_status "$SERVICE_ID" "$DEPLOYMENT_ID"

    sleep $WAIT_TIME

    if [ "$WAIT_TIME" -gt 10 ]; then
      WAIT_TIME=$((WAIT_TIME / 2))
    fi
  done

  echo "timed out"
  exit 1
}

# check_dockerfile_version TAG - the thin Render Dockerfile must be
# `FROM darthjee/kerghan:TAG`, otherwise Render would build another release.
function check_dockerfile_version() {
  TAG=$1

  if [ -z "$TAG" ]; then
    echo "invalid release tag: a release tag is required" >&2
    exit 1
  fi

  DOCKERFILE_TAG=""
  if [ -f "$RENDER_DOCKERFILE" ]; then
    DOCKERFILE_TAG=$(sed -n -e 's|^FROM darthjee/kerghan:\([^[:space:]]*\)[[:space:]]*$|\1|p' \
      "$RENDER_DOCKERFILE" | head -n 1)
  fi

  if [ "$DOCKERFILE_TAG" != "$TAG" ]; then
    echo "dockerfile version mismatch: $RENDER_DOCKERFILE has '${DOCKERFILE_TAG:-none}'," \
      "release is '$TAG' (run scripts/bump_version.sh)" >&2
    exit 1
  fi
}

function force_deploy() {
  TAG=$1
  check_dockerfile_version "$TAG"

  SERVICE_ID=$(service_id)
  if [ -z "$SERVICE_ID" ]; then
    echo "render service not found: $RENDER_SERVICE_NAME" >&2
    exit 1
  fi

  echo "UPDATING BRANCH TO $TAG"
  RESPONSE=$(update_service_branch "$SERVICE_ID" "$TAG") || {
    echo "branch update failed: $RESPONSE" >&2
    exit 1
  }

  echo "DEPLOYING $TAG"
  RESPONSE=$(deploy "$SERVICE_ID") || {
    echo "deploy request failed: $RESPONSE" >&2
    exit 1
  }

  DEPLOYMENT_ID=$(echo "$RESPONSE" | jq -r '.id')
  if [ -z "$DEPLOYMENT_ID" ] || [ "$DEPLOYMENT_ID" == "null" ]; then
    echo "deploy request returned no deploy id: $RESPONSE" >&2
    exit 1
  fi

  watch_deployment "$SERVICE_ID" "$DEPLOYMENT_ID"
}

function run_deploy() {
  checkLastVersion
  force_deploy "$CIRCLE_TAG"
}

function watch_last_deployment() {
  checkLastVersion
  SERVICE_ID=$(service_id)
  DEPLOYMENT_ID=$(last_deployment "$SERVICE_ID" | jq '.deploy.id' | sed -e 's/"//g')
  watch_deployment "$SERVICE_ID" "$DEPLOYMENT_ID"
}

ACTION=$1
shift

case $ACTION in
  "deploy")
    run_deploy
    ;;
  "force_deploy")
    force_deploy "$@"
    ;;
  "watch")
    watch_last_deployment
    ;;
  "service_id")
    service_id
    ;;
  *)
    $ACTION "$@"
    ;;
esac
