.PHONY: install fetch-data run test docker-up docker-down clean db-init db-migrate import-osm

install:
	python -m pip install -r requirements.txt

fetch-data:
	python -m backend.scripts.fetch_data

run:
	python -m backend.app

test:
	python -m pytest tests/ -v

docker-up:
	docker-compose up --build -d

docker-down:
	docker-compose down

db-init:
	python -c "from backend.db.models import Base; from backend.db.engine import get_engine; Base.metadata.create_all(get_engine()); print('Tables created.')"

alembic-init:
	alembic init backend/alembic

db-migrate:
	alembic upgrade head

import-osm:
	python -m backend.scripts.import_osm

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	find . -type f -name "*.pyc" -delete 2>/dev/null; true
	rm -rf .pytest_cache htmlcov .coverage
