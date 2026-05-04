FROM python:3.11-slim

WORKDIR /app

# Cài đặt dependencies trước (tận dụng Docker cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY backend/ backend/
COPY frontend/ frontend/
COPY data/ data/

EXPOSE 5000

# Sử dụng 1 worker vì mỗi worker load toàn bộ graph vào RAM
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:5000", "backend.app:create_app()"]
