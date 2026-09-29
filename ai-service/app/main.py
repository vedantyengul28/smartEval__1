import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name} v{settings.version}")
    logger.info(f"Mock mode: {settings.use_mock_mode}")
    logger.info(f"Model cache dir: {settings.model_cache_dir}")
    try:
        from .services.sbert_service import _load_sbert
        _load_sbert()
    except Exception as e:
        logger.warning(f"Preload SBERT skipped: {e}")
    try:
        from .services.trocr_service import _load_trocr
        _load_trocr()
    except Exception as e:
        logger.warning(f"Preload TrOCR skipped: {e}")
    logger.info("SmartEval AI service ready")
    yield
    logger.info("Shutting down AI service")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description="SmartEval AI Service: SBERT semantic similarity, TrOCR handwritten OCR, rubric-based evaluation engine",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from .api import router as ai_router
    app.include_router(ai_router)

    @app.get("/")
    async def root():
        return {
            "service": settings.app_name,
            "version": settings.version,
            "status": "running",
            "docs": "/docs",
            "health": "/ai/health",
        }

    return app


app = create_app()
