## UBID Platform — development commands

.PHONY: up down seed ingest generate dev-api dev-web

## Start full stack (PostgreSQL + Redis + API + Worker + Frontend)
up:
	cd infra && docker compose up -d

## Stop all services
down:
	cd infra && docker compose down

## Install backend deps (local)
install-api:
	cd backend && pip install -r requirements.txt

## Install frontend deps
install-web:
	cd frontend && npm install

## Generate synthetic data
generate:
	python scripts/generate_synthetic_data.py

## Seed DB (users + departments)
seed:
	python scripts/seed_db.py

## Run ingestion pipeline
ingest:
	python scripts/ingest.py

## Run everything fresh
bootstrap: generate seed ingest
	@echo "Bootstrap complete. Run 'make dev-api' and 'make dev-web'."

## Start FastAPI locally
dev-api:
	cd backend && uvicorn app.main:app --reload --port 8000

## Start Next.js locally
dev-web:
	cd frontend && npm run dev

## Trigger entity resolution (API must be running)
er:
	curl -s -X POST http://localhost:8000/api/v1/er/run \
		-H "Content-Type: application/json" | python -m json.tool

## Full fresh demo setup (seed → ingest → ER requires running API)
demo-reset: seed ingest
	@echo "DB seeded and ingested. Start API with 'make dev-api', then run 'make er'."

## Production build check (frontend)
build-check:
	cd frontend && npm run build

## Syntax check backend Python
lint-py:
	python -m py_compile backend/app/main.py \
		backend/app/api/routes/graph.py \
		backend/app/api/routes/auth.py \
		backend/app/api/routes/search.py \
		backend/app/api/routes/business.py \
		backend/app/services/entity_resolver.py \
		&& echo "Python syntax OK"
