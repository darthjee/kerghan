#!/bin/bash

# Publishes the production image darthjee/kerghan to Docker Hub as a
# multi-arch manifest (linux/amd64 + linux/arm64), tagged <CIRCLE_TAG> and latest.

set -euo pipefail

IMAGE=kerghan
BASE_IMAGE=production_kerghan-base
PLATFORMS=linux/amd64,linux/arm64

function require_tag() {
  if [ -z "${CIRCLE_TAG:-}" ]; then
    echo "CIRCLE_TAG is empty: $IMAGE is only released on tag builds." >&2
    exit 1
  fi
}

function base_version() {
  local version
  version=$(cat version | grep "^${BASE_IMAGE}=" | sed -e "s/${BASE_IMAGE}=//g")

  if [ -z "$version" ]; then
    echo "No ${BASE_IMAGE} entry found in the version file." >&2
    exit 1
  fi

  echo "$version"
}

function setup_builder() {
  docker run --privileged --rm tonistiigi/binfmt --install all
  # The default `docker` driver cannot push multi-platform images.
  docker buildx create --use
}

function login() {
  echo "$DOCKER_HUB_PASSWORD" | docker login -u "$DOCKER_HUB_USERNAME" --password-stdin
}

function release() {
  require_tag

  local version
  version=$(base_version)
  local repo="$DOCKER_ID_USER/$IMAGE"

  setup_builder
  login

  docker buildx build --platform "$PLATFORMS" \
    -f dockerfiles/production_kerghan/Dockerfile \
    --build-arg "BASE_VERSION=$version" \
    -t "$repo:$CIRCLE_TAG" \
    -t "$repo:latest" \
    --push .

  docker buildx imagetools inspect "$repo:$CIRCLE_TAG"
}

ACTION=${1:-}

case $ACTION in
  "release") release ;;
  *)
    echo "Usage: $0 release"
    exit 1
    ;;
esac
