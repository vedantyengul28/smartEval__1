import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)


class Settings:
    app_name: str = "SmartEval AI Service"
    version: str = "1.0.0"
    host: str = "0.0.0.0"
    port: int = int(os.getenv("AI_PORT", "8000"))

    use_mock_mode: bool = os.getenv("AI_USE_MOCK_MODE", "true").lower() == "true"
    model_cache_dir: str = os.getenv("AI_MODEL_CACHE_DIR", "./models")

    sbert_model: str = os.getenv("SBERT_MODEL", "paraphrase-MiniLM-L6-v2")
    trocr_model: str = os.getenv("TROCR_MODEL", "microsoft/trocr-base-handwritten")
    trocr_processor: str = os.getenv("TROCR_PROCESSOR", "microsoft/trocr-base-handwritten")

    uploads_dir: str = os.getenv("UPLOAD_DIR", "./uploads")


settings = Settings()
Path(settings.model_cache_dir).mkdir(parents=True, exist_ok=True)
Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
