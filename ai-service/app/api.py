import logging

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from ..config import settings
from ..schemas import (
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    OCRRequest,
    OCRResponse,
    SemanticSimilarityRequest,
    SemanticSimilarityResponse,
    HealthResponse,
)
from .services.evaluation_engine import evaluate_answer
from .services.trocr_service import process_file
from .services.sbert_service import compute_similarity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    models_status = {
        "sbert": {"available": not settings.use_mock_mode, "model": settings.sbert_model},
        "trocr": {"available": not settings.use_mock_mode, "model": settings.trocr_model},
    }
    return HealthResponse(
        status="healthy",
        models=models_status,
        mockMode=settings.use_mock_mode,
        version=settings.version,
    )


@router.post("/evaluate-answer", response_model=EvaluateAnswerResponse)
async def evaluate_answer_endpoint(request: EvaluateAnswerRequest):
    try:
        result = evaluate_answer(request)
        return result
    except Exception as e:
        logger.exception(f"Evaluation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evaluation pipeline failed: {str(e)}",
        )


@router.post("/ocr", response_model=OCRResponse)
async def ocr_endpoint(request: OCRRequest):
    file_path = request.get_path()
    file_type = request.get_type()
    if not file_path:
        raise HTTPException(status_code=400, detail="File path is required")

    try:
        extracted, pages, fallback = process_file(file_path, file_type)
        return OCRResponse(
            extractedText=extracted,
            confidence=None,
            pageCount=pages,
            page_count=pages,
            usedFallback=fallback,
            used_fallback=fallback,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        logger.exception(f"OCR failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}",
        )


@router.post("/semantic-similarity", response_model=SemanticSimilarityResponse)
async def similarity_endpoint(request: SemanticSimilarityRequest):
    try:
        sim, fallback = compute_similarity(request.text1, request.text2)
        return SemanticSimilarityResponse(
            similarity=round(sim, 4),
            text1Tokens=len(request.text1.split()),
            text2Tokens=len(request.text2.split()),
            usedFallback=fallback,
        )
    except Exception as e:
        logger.exception(f"Similarity failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Similarity computation failed: {str(e)}",
        )
