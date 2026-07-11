.PHONY: setup build up down logs shell console spec lint security

setup:
	@test -f .env || cp .env.sample .env
	docker compose build
	docker compose run --rm web bin/rails db:prepare

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f web

shell:
	docker compose run --rm web bash

console:
	docker compose run --rm web bin/rails console

spec:
	docker compose run --rm -e RAILS_ENV=test web bin/rspec

lint:
	docker compose run --rm web bin/rubocop

security:
	docker compose run --rm web bin/brakeman --no-pager
	docker compose run --rm web bin/bundler-audit check --update
