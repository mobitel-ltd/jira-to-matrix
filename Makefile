debug:
	npm run debug

dev:
	npm run start-dev

dev-jira:
	cp config.jira.json config.json
	npm run start-dev

dev-gitlab:
	cp config.gitlab.json config.json
	npm run start-dev

test:
	npm run test-all

start:
	npm run start-dev

.PHONY: test

app-build:
	docker-compose build --no-cache

app-run:
	docker-compose up

app-kill:
	docker-compose down -v

git:
	npm run format
	npm run lint
	npm run compile:test
	npm run test-all
	git add .
	git commit -m "$m"
	git push origin HEAD
