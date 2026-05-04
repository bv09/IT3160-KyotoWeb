.PHONY: install fetch-data run test docker-up docker-down clean

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

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	find . -type f -name "*.pyc" -delete 2>/dev/null; true
	rm -rf .pytest_cache htmlcov .coverage
