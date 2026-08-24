FROM darthjee/scripts:0.8.0 as scripts
FROM darthjee/node:0.2.1 as base

USER root
RUN apt-get update && apt-get install -y rsync && rm -rf /var/lib/apt/lists/*
USER node

COPY --chown=node:node \
  ./backend/package.json backend/yarn.lock \
  /home/node/app/

######################################

FROM base as builder

ENV HOME_DIR /home/node

USER root
COPY --chown=node:node --from=scripts /home/scripts/builder/yarn_builder.sh /usr/local/sbin/yarn_builder.sh
RUN /bin/bash yarn_builder.sh

#######################
# FINAL IMAGE
FROM base
ENV HOME_DIR /home/node

COPY --chown=node:node --from=builder /home/node/yarn/new/ /usr/local/share/.cache/yarn/v6/

USER node

# The dev container mounts ./backend over /home/node/app at runtime (see
# docker-compose.yml), so there's no compiled TS source at image-build time —
# the build has to run against the mounted source right before starting the
# compiled Nest entrypoint.
CMD ["sh", "-c", "yarn build && node dist/main.js"]
