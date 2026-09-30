build-ApiFunction:
	npm ci
	npm run build
	cp package.json package-lock.json "$(ARTIFACTS_DIR)/"
	cp -r dist public "$(ARTIFACTS_DIR)/"
	cd "$(ARTIFACTS_DIR)" && npm ci --omit=dev
