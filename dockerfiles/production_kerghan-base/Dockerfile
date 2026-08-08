FROM darthjee/scripts:0.8.0 as scripts
FROM darthjee/node:0.2.1 as base

CMD ["node", "bin/server.js"]

######################################

FROM base as builder

COPY --chown=node:node \
  ./backend/package.json backend/yarn.lock \
  /home/node/app/

ENV HOME_DIR /home/node

USER node
COPY --chown=node:node --from=scripts /home/scripts/builder/yarn_builder.sh /usr/local/sbin/yarn_builder.sh
# TODO: confirm whether yarn_builder.sh takes a production-only-deps flag
# (mirrors majora's `poetry_builder.sh --only main`) once darthjee/scripts is inspectable.
RUN /bin/bash yarn_builder.sh

#######################
# FINAL IMAGE
FROM base
ENV HOME_DIR /home/node

COPY --chown=node:node --from=builder /home/node/yarn/new/ /usr/local/share/.cache/yarn/v6/
USER node
