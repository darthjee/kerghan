FROM darthjee/scripts:0.8.0 as scripts
FROM darthjee/circleci_node:0.2.1 as base

USER root
RUN apt-get update && apt-get install -y rsync && rm -rf /var/lib/apt/lists/*
USER circleci

######################################

FROM base as builder

COPY --chown=circleci:circleci \
  ./backend/package.json backend/yarn.lock \
  /home/circleci/project

ENV HOME_DIR /home/circleci

USER circleci
COPY --chown=circleci:circleci --from=scripts /home/scripts/builder/yarn_builder.sh /usr/local/sbin/yarn_builder.sh
RUN /bin/bash yarn_builder.sh

#######################
# FINAL IMAGE
FROM base

COPY --chown=circleci:circleci --from=builder /home/circleci/yarn/new/ /home/circleci/.cache/yarn/v6/
USER circleci
