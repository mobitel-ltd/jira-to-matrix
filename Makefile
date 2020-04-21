debug:
	npm run debug

dev:
	npm run dev

test:
	npm test -- --watch

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
	git add .
	git commit -m "$m"
	git push origin HEAD
