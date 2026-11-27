#!/usr/bin/env bash
set -euo pipefail
set -x

tent_version=$(grep '^tent=' version | sed -e 's/^tent=//' || true)

if [ -z "$tent_version" ]; then
  echo "The version file has no tent= entry (or it is empty):" \
    "cannot select the darthjee/tent image." >&2
  exit 1
fi

docker run --rm -v "$PWD":/repo "darthjee/tent:$tent_version" sh -c '
  find /repo/proxy -name "*.php" -print0 | xargs -0 -n1 php -l
'
docker-compose run --rm proxy_lint
docker-compose run proxy_tests
