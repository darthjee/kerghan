#!/bin/bash

# Publishes darthjee/kerghan-standalone to Docker Hub as multi-arch manifests
# (linux/amd64 + linux/arm64):
#
#   <CIRCLE_TAG>           online image (pulls the inner images on first boot)
#   <CIRCLE_TAG>-offline   offline image (inner images preloaded from tarballs)
#   latest / latest-offline  moved only after the offline smoke test passes
#
# The offline stage copies standalone/images/${TARGETARCH}/ into the image, so
# the inner images are saved once per architecture before the build.

set -euo pipefail

IMAGE=kerghan-standalone
PLATFORMS=linux/amd64,linux/arm64
ARCHES="amd64 arm64"
MYSQL_IMAGE=mysql:9.3.0
TENT_IMAGE=darthjee/tent:1.0.3
IMAGES_DIR=standalone/images
DOCKERFILE=dockerfiles/kerghan_standalone/Dockerfile

function require_tag() {
  if [ -z "${CIRCLE_TAG:-}" ]; then
    echo "CIRCLE_TAG is empty: $IMAGE is only released on tag builds." >&2
    exit 1
  fi
}

function setup_builder() {
  docker run --privileged --rm tonistiigi/binfmt --install all
  # The default `docker` driver cannot push multi-platform images.
  docker buildx create --use
}

function login() {
  echo "$DOCKER_HUB_PASSWORD" | docker login -u "$DOCKER_HUB_USERNAME" --password-stdin
}

function tent_image_for() {
  local arch=$1

  if [ "$arch" = "amd64" ]; then
    echo "$TENT_IMAGE"
  else
    echo "$TENT_IMAGE-$arch"
  fi
}

# Pulls <image> for <arch>, checks the local copy really is <arch> and saves
# it to standalone/images/<arch>/<name>.tar.
function save_image() {
  local arch=$1
  local image=$2
  local name=$3
  local actual

  docker pull --platform "linux/$arch" "$image"

  actual=$(docker image inspect -f '{{.Architecture}}' "$image")
  if [ "$actual" != "$arch" ]; then
    echo "$image is $actual, expected $arch." >&2
    exit 1
  fi

  docker save "$image" -o "$IMAGES_DIR/$arch/$name.tar"
}

# One architecture at a time: with the classic image store a new pull of the
# same tag replaces the local copy.
function save_images() {
  local version=$1
  local arch

  for arch in $ARCHES; do
    rm -rf "${IMAGES_DIR:?}/$arch"
    mkdir -p "$IMAGES_DIR/$arch"

    save_image "$arch" "darthjee/kerghan:$version" kerghan
    save_image "$arch" "$MYSQL_IMAGE" mysql
    save_image "$arch" "$(tent_image_for "$arch")" tent
  done
}

function build_push() {
  local repo=$1
  local version=$2

  docker buildx build --platform "$PLATFORMS" \
    -f "$DOCKERFILE" \
    --build-arg "KERGHAN_VERSION=$version" \
    --target standalone \
    -t "$repo:$version" \
    --push .

  # Reuses the cached frontend and online layers from the build above.
  docker buildx build --platform "$PLATFORMS" \
    -f "$DOCKERFILE" \
    --build-arg "KERGHAN_VERSION=$version" \
    --target standalone-offline \
    -t "$repo:$version-offline" \
    --push .
}

# Smoke-tests the published offline image on this (amd64) machine.
function smoke() {
  local repo=$1
  local version=$2

  docker pull --platform linux/amd64 "$repo:$version-offline"

  IMAGE="$repo:$version-offline" \
    SKIP_BUILD=true \
    KERGHAN_VERSION="$version" \
    SMOKE_EXPECT_OFFLINE=true \
    standalone/scripts/smoke_test.sh
}

function promote() {
  local repo=$1
  local version=$2

  docker buildx imagetools create -t "$repo:latest" "$repo:$version"
  docker buildx imagetools create -t "$repo:latest-offline" "$repo:$version-offline"
}

function inspect() {
  local repo=$1
  local version=$2
  local tag

  for tag in "$version" "$version-offline" latest latest-offline; do
    docker buildx imagetools inspect "$repo:$tag"
  done
}

function release() {
  require_tag

  local version=$CIRCLE_TAG
  local repo="$DOCKER_ID_USER/$IMAGE"

  setup_builder
  login

  save_images "$version"
  build_push "$repo" "$version"
  smoke "$repo" "$version"
  promote "$repo" "$version"
  inspect "$repo" "$version"
}

ACTION=${1:-}

case $ACTION in
  "release") release ;;
  *)
    echo "Usage: $0 release"
    exit 1
    ;;
esac
