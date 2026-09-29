FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    AI_MODEL_CACHE_DIR=/app/models \
    AI_USE_MOCK_MODE=true

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libgomp1 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt || \
    (echo "Lightweight install: skipping large ML packages"; \
     pip install --no-cache-dir fastapi==0.109.0 uvicorn[standard]==0.27.0 pydantic==2.5.3 \
     python-multipart==0.0.6 python-dotenv==1.0.0 httpx==0.26.0 Pillow==10.2.0 numpy==1.26.3 scikit-learn==1.4.0)

RUN mkdir -p /app/models /app/uploads

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/ai/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
