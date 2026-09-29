from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class Criterion(BaseModel):
    id: Optional[str] = None
    criterionName: Optional[str] = None
    criterion_name: Optional[str] = None
    description: Optional[str] = None
    maximumMarks: Optional[int] = None
    maximum_marks: Optional[int] = None
    sortOrder: Optional[int] = 0
    sort_order: Optional[int] = 0
    keywords: Optional[str] = None

    def get_name(self) -> str:
        return self.criterionName or self.criterion_name or "Unnamed Criterion"

    def get_max_marks(self) -> int:
        return self.maximumMarks or self.maximum_marks or 0


class EvaluateAnswerRequest(BaseModel):
    question: str
    referenceAnswer: str
    studentAnswer: str
    rubricCriteria: Optional[List[Criterion]] = None
    rubric_criteria: Optional[List[Criterion]] = None
    extractedText: Optional[str] = None
    extracted_text: Optional[str] = None

    def get_criteria(self) -> List[Criterion]:
        return self.rubricCriteria or self.rubric_criteria or []

    def get_student_text(self) -> str:
        return self.extractedText or self.extracted_text or self.studentAnswer or ""


class CriterionResult(BaseModel):
    name: str
    maxMarks: int
    awardedMarks: float
    reason: str


class EvaluateAnswerResponse(BaseModel):
    totalMarks: float
    maxMarks: int
    criteria: List[CriterionResult]
    feedback: str
    semanticSimilarity: Optional[float] = None
    _fallback: Optional[bool] = False


class OCRRequest(BaseModel):
    filePath: Optional[str] = None
    file_path: Optional[str] = None
    fileType: Optional[str] = None
    file_type: Optional[str] = None

    def get_path(self) -> str:
        return self.filePath or self.file_path or ""

    def get_type(self) -> str:
        return (self.fileType or self.file_type or "png").lower()


class OCRResponse(BaseModel):
    extractedText: str
    confidence: Optional[float] = None
    pageCount: Optional[int] = None
    page_count: Optional[int] = None
    usedFallback: bool = False
    used_fallback: bool = False


class SemanticSimilarityRequest(BaseModel):
    text1: str
    text2: str


class SemanticSimilarityResponse(BaseModel):
    similarity: float
    text1Tokens: Optional[int] = None
    text2Tokens: Optional[int] = None
    usedFallback: bool = False


class HealthResponse(BaseModel):
    status: str
    models: Dict[str, Any]
    mockMode: bool
    version: str
