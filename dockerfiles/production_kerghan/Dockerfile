# The Dockerfile Render builds for the production `kerghan` service.
# It only pulls the published darthjee/kerghan release image (built from
# dockerfiles/release_kerghan/Dockerfile); everything, ENTRYPOINT included, is inherited.
# The version is pinned by scripts/bump_version.sh and checked by scripts/deploy.sh.
FROM darthjee/kerghan:0.7.0
