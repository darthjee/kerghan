# Runs the whole standalone bats suite (standalone/test) on bash 3.2.57, the bash macOS ships;
# see docs/agents/standalone/client-completion.md#bash-32.
#
# The official bash:3.2 image keeps bash 3.2.57 at /usr/local/bin/bash, the only bash on PATH.
# Never `apk add bash` (or bats, which depends on it): that would put a second, newer bash on
# PATH. bats-core is installed from the upstream v1.11.0 tag (the bats/bats:1.11.0 pin) and git,
# needed only to fetch it, is removed in the same layer. The CircleCI job
# standalone_tests_bash32 mirrors these steps.
FROM bash:3.2

ARG BATS_VERSION=v1.11.0

RUN apk add --no-cache --virtual .bats-build git \
 && git clone --depth 1 --branch "$BATS_VERSION" https://github.com/bats-core/bats-core.git /tmp/bats-core \
 && /tmp/bats-core/install.sh /usr/local \
 && rm -rf /tmp/bats-core \
 && apk del .bats-build
