#!/usr/bin/env bash
set -euo pipefail
set -x

docker-compose run --rm kerghan_fe yarn coverage
docker-compose run --rm kerghan_fe yarn lint
