.PHONY: setup run lint format check docker-build docker-up docker-down docker-logs

# ── Local development ────────────────────────────────────────────────────────

setup:
	uv sync

run:
	uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

lint:
	uv run ruff check .

format:
	uv run ruff format .

check: lint

# ── Docker ────────────────────────────────────────────────────────────────────

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-restart: docker-down docker-up
