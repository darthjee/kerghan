.PHONY: build-base push-base build build-fe-base push-fe-base build-fe push-fe build-circleci-base push-circleci-base build-production-base push-production-base dev dev-up setup tests integrations-keys-status integrations-keys-reencrypt build-standalone standalone-smoke

PROJECT?=kerghan
DOCKER_ID_USER?=darthjee
IMAGE?=$(DOCKER_ID_USER)/dev_$(PROJECT)
BASE_VERSION?=0.1.0
FE_IMAGE?=$(DOCKER_ID_USER)/vite_$(PROJECT)
DOCKER_FILE=dockerfiles/$(PROJECT)/Dockerfile
DOCKER_FILE_FE=dockerfiles/vite_$(PROJECT)/Dockerfile
STANDALONE_IMAGE?=$(DOCKER_ID_USER)/$(PROJECT)-standalone:dev
KERGHAN_VERSION?=latest
DOCKER_FILE_STANDALONE=dockerfiles/$(PROJECT)_standalone/Dockerfile

# ── Base images ────────────────────────────────────────────────────────────────

build-base:
	bin/image.sh build $(PROJECT)-base

push-base:
	bin/image.sh push $(PROJECT)-base

build-circleci-base:
	bin/image.sh build circleci_$(PROJECT)-base

push-circleci-base:
	bin/image.sh push circleci_$(PROJECT)-base

build-production-base:
	bin/image.sh build production_$(PROJECT)-base

push-production-base:
	bin/image.sh push production_$(PROJECT)-base

build-fe-base:
	bin/image.sh build vite_$(PROJECT)-base

push-fe-base:
	bin/image.sh push vite_$(PROJECT)-base

# ── Backend ──────────────────────────────────────────────────────────────────
# Note: the leaf dev_kerghan (backend dev app) and kerghan (production) images
# are not published to Docker Hub — only the 4 *-base images are (see
# .claude/agents/infra.md "Backend image publishing" and
# docs/agents/architecture/backend.md). `make build` tags the dev image only
# darthjee/dev_kerghan; it never tags anything darthjee/kerghan (the production
# image's name).

build:
	docker build -f $(DOCKER_FILE) . -t $(IMAGE)

# ── Frontend ─────────────────────────────────────────────────────────────────

build-fe:
	docker build -f $(DOCKER_FILE_FE) . -t $(FE_IMAGE) -t $(FE_IMAGE):$(BASE_VERSION)

push-fe:
	make build-fe
	docker push $(FE_IMAGE)
	docker push $(FE_IMAGE):$(BASE_VERSION)

# ── Standalone ───────────────────────────────────────────────────────────────
# standalone-smoke needs --privileged support on the host Docker; its CI job lands in #343.

build-standalone:
	DOCKER_BUILDKIT=1 docker build -f $(DOCKER_FILE_STANDALONE) --target standalone --build-arg KERGHAN_VERSION=$(KERGHAN_VERSION) -t $(STANDALONE_IMAGE) .

standalone-smoke:
	IMAGE=$(STANDALONE_IMAGE) KERGHAN_VERSION=$(KERGHAN_VERSION) standalone/scripts/smoke_test.sh

# ── Development ───────────────────────────────────────────────────────────────

setup: .env
	docker-compose run --rm $(PROJECT)_app yarn migration:run

dev:
	docker-compose run $(PROJECT)_app /bin/bash

dev-up:
	docker-compose up $(PROJECT)_proxy $(PROJECT)_app $(PROJECT)_fe

tests:
	docker-compose run $(PROJECT)_tests /bin/bash

# Integrations key rotation (KERGHAN_INTEGRATIONS_KEY / KERGHAN_PREVIOUS_INTEGRATIONS_KEYS).
# Both build dist/ first; they need a reachable kerghan_mysql, like `make setup`.
integrations-keys-status:
	docker-compose run --rm $(PROJECT)_app sh -c "yarn build && yarn integrations:keys:status"

integrations-keys-reencrypt:
	docker-compose run --rm $(PROJECT)_app sh -c "yarn build && yarn integrations:keys:reencrypt"

# ── Environment files ─────────────────────────────────────────────────────────

.env:
	cp .env.dev.sample .env

.env.production:
	touch .env.production
