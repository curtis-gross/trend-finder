# Multi-stage build: Node.js for frontend assets + Python 3.11 for FastAPI backend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime Stage: Python 3.11 Slim
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY main.py ./
COPY public/ ./public/

COPY --from=frontend-builder /app/dist ./dist

ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV COMPANY_NAME="test-company"

EXPOSE 8080

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
