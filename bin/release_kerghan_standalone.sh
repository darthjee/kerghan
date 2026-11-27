#!/bin/bash

# Publishes darthjee/kerghan-standalone to Docker Hub as multi-arch manifests
# (linux/amd64 + linux/arm64):
#
#   <CIRCLE_TAG>           online image (pulls the inner images on first boot)
#   <CIRCLE_TAG>-offline   offline image (inner images preloaded from tarballs)
#   latest / latest-offline  moved only after the offline smoke test passes
#
# The offline stage copies standalone/images/${TARGETARCH}/ into the image, so
# the inner images (kerghan, mysql, mysql-legacy, tent and the docker-cli log
# collector tarballs) are saved once per architecture before the build.
#
# The Tent version is the `tent=` line of the root `version` file (the script runs
# from the repository root). It names a single multi-arch tag: the release fails
# if that tag lacks the manifest of an architecture being saved.

set -euo pipefail

IMAGE=kerghan-standalone
PLATFORMS=linux/amd64,linux/arm64
ARCHES="amd64 arm64"
MYSQL_IMAGE=mysql:8.4.11
MYSQL_LEGACY_IMAGE=mysql:9.3.0
# Empty when `version` has no `tent=` entry: rejected by require_tent_version.
TENT_VERSION=$(grep '^tent=' version | sed -e 's/^tent=//' || true)
TENT_IMAGE="darthjee/tent:$TENT_VERSION"
# Log collector image: must match LOGS_IMAGE in the standalone Dockerfile's .env step.
LOGS_IMAGE=docker:27.5.1-cli
IMAGES_DIR=standalone/images
DOCKERFILE=dockerfiles/kerghan_standalone/Dockerfile

function require_tag() {
  if [ -z "${CIRCLE_TAG:-}" ]; then
    echo "CIRCLE_TAG is empty: $IMAGE is only released on tag builds." >&2
    exit 1
  fi
}

function require_tent_version() {
  if [ -z "$TENT_VERSION" ]; then
    echo "The version file has no tent= entry (or it is empty):" \
      "cannot select the Tent image." >&2
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

# Prints the digest(s) of the linux/<arch> manifest(s) of <image>: the matching
# entries of an index / manifest list (variant ignored, so arm64/v8 matches and
# unknown/unknown attestations never do) or, for a single-platform manifest,
# its own digest.
function platform_digest() {
  local arch=$1
  local image=$2

  docker buildx imagetools inspect "$image" --format '{{json .Manifest}}' \
    | jq -r --arg a "$arch" '
        if .manifests
        then [.manifests[] | select(.platform.os == "linux" and .platform.architecture == $a) | .digest]
        else [.digest]
        end | .[]'
}

# Fails unless <image> publishes a linux/<arch> manifest. A tag that cannot be
# inspected at all fails with the inspect error instead of this message.
function require_platform_manifest() {
  local arch=$1
  local image=$2
  local digests

  digests=$(platform_digest "$arch" "$image") || exit 1

  if ! echo "$digests" | grep -qE '^sha256:[0-9a-f]{64}$'; then
    echo "$image has no linux/$arch manifest;" \
      "Tent must be published as a multi-arch tag." >&2
    exit 1
  fi
}

# Pulls the linux/<arch> manifest of <image> by digest, re-tags it as <image>,
# checks the local copy really is <arch> and saves it to
# standalone/images/<arch>/<name>.tar.
function save_image() {
  local arch=$1
  local image=$2
  local name=$3
  local digests
  local digest
  local actual
  # Assumes no registry host with a port in the image name (repo:tag only).
  local repo=${image%:*}

  digests=$(platform_digest "$arch" "$image" | grep -E '^sha256:[0-9a-f]{64}$' || true)

  if [ -z "$digests" ]; then
    echo "$image has no linux/$arch manifest." >&2
    exit 1
  fi
  if [ "$(echo "$digests" | wc -l)" -gt 1 ]; then
    echo "$image has several linux/$arch manifests." >&2
    exit 1
  fi
  digest=$digests

  docker pull "$repo@$digest"
  docker tag "$repo@$digest" "$image"

  actual=$(docker image inspect -f '{{.Architecture}}' "$image")
  if [ "$actual" != "$arch" ]; then
    echo "$image is $actual, expected $arch." >&2
    exit 1
  fi

  docker save "$image" -o "$IMAGES_DIR/$arch/$name.tar"
}

# One architecture at a time. Pulling by per-platform digest and re-tagging
# leaves a single-platform local image on both the classic and the containerd
# image store (where a plain `--platform` pull would add to a multi-platform
# image), so the architecture check and `docker save` are per-arch.
function save_images() {
  local version=$1
  local arch

  for arch in $ARCHES; do
    rm -rf "${IMAGES_DIR:?}/$arch"
    mkdir -p "$IMAGES_DIR/$arch"

    save_image "$arch" "darthjee/kerghan:$version" kerghan
    save_image "$arch" "$MYSQL_IMAGE" mysql
    # Exists only for the #469 migration (9.3.0 -> 8.4.11); remove it together
    # with the compose `mysql-legacy` service.
    save_image "$arch" "$MYSQL_LEGACY_IMAGE" mysql-legacy
    require_platform_manifest "$arch" "$TENT_IMAGE"
    save_image "$arch" "$TENT_IMAGE" tent
    save_image "$arch" "$LOGS_IMAGE" docker-cli
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
  require_tent_version

  local version=$CIRCLE_TAG
  local repo="$DOCKER_ID_USER/$IMAGE"

  setup_builder
  docker version
  docker info -f '{{.Driver}} {{json .DriverStatus}}' || true
  login

  save_images "$version"
  build_push "$repo" "$version"
  smoke "$repo" "$version"
  promote "$repo" "$version"
  inspect "$repo" "$version"
}

# Runs only when executed, not when sourced (the bats tests source it).
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  ACTION=${1:-}

  case $ACTION in
    "release") release ;;
    *)
      echo "Usage: $0 release"
      exit 1
      ;;
  esac
fi
