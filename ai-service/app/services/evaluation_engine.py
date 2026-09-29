import re
import math
import logging
from typing import List, Dict, Any, Tuple

from ..schemas import EvaluateAnswerRequest, Criterion, CriterionResult, EvaluateAnswerResponse
from .sbert_service import sentence_level_similarity, keyword_coverage, compute_similarity

logger = logging.getLogger(__name__)


def _count_words(text: str) -> int:
    if not text:
        return 0
    return len(re.findall(r"\w+", text))


def _sentence_split(text: str) -> List[str]:
    parts = re.split(r"[.!?]+", text or "")
    return [p.strip() for p in parts if len(p.strip()) > 3]


def _assess_criterion(
    criterion: Criterion,
    student_text: str,
    reference_text: str,
    overall_sim: float,
    criterion_weights: Dict[str, float],
) -> Tuple[float, str, float]:
    name = criterion.get_name()
    max_marks = criterion.get_max_marks()
    key_lower = name.lower()

    ref_sents = _sentence_split(reference_text)
    stu_sents = _sentence_split(student_text)

    kw = criterion.keywords or ""
    kw_score = keyword_coverage(kw, student_text)

    refs_for_criterion = []
    keywords_for_match = (kw + " " + name).lower().split()
    keywords_for_match = [k for k in keywords_for_match if len(k) > 2]

    for rs in ref_sents:
        rs_lower = rs.lower()
        if any(k in rs_lower for k in keywords_for_match):
            refs_for_criterion.append(rs)

    if not refs_for_criterion:
        for rs in ref_sents:
            sim, _ = compute_similarity(rs.lower(), key_lower + " " + (kw or "").lower())
            if sim > 0.3:
                refs_for_criterion.append(rs)

    matched_stu_texts = []
    sim_score = 0.0
    if refs_for_criterion:
        matched_max = []
        for rs in refs_for_criterion:
            best = 0.0
            for ss in stu_sents:
                s, _ = compute_similarity(rs, ss)
                if s > best:
                    best = s
            matched_max.append(best)
        if matched_max:
            sim_score = sum(matched_max) / len(matched_max)

    criteria_weights = criterion_weights.get(name, {
        "similarity": 0.40,
        "keywords": 0.35,
        "length": 0.25,
    })

    avg_ref_words = max(1, sum(_count_words(r) for r in refs_for_criterion) / max(1, len(refs_for_criterion)))
    words_about_criterion = max(0, _count_words(student_text) // max(1, max(1, len(ref_sents) or 1)))
    length_ratio = min(1.0, words_about_criterion / max(1, avg_ref_words * 0.4)) if refs_for_criterion else min(1.0, _count_words(student_text) / 40)

    weighted = (
        criteria_weights["similarity"] * sim_score
        + criteria_weights["keywords"] * kw_score
        + criteria_weights["length"] * length_ratio
    )

    if any(k in key_lower for k in ["define", "definition"]):
        coverage_keywords = ["is", "refers to", "defined as", "type of", "data structure"]
        student_lower = student_text.lower()
        has_any = any(k in student_lower for k in coverage_keywords)
        if has_any:
            weighted = min(1.0, weighted + 0.1)
        else:
            weighted = max(0.0, weighted - 0.1)

    if any(k in key_lower for k in ["explain", "explanation", "principle", "concept"]):
        if len(stu_sents) >= 2:
            weighted = min(1.0, weighted + 0.05)

    if any(k in key_lower for k in ["operation", "push", "pop", "peek", "enqueue", "dequeue"]):
        op_list = ["push", "pop", "peek", "enqueue", "dequeue", "top", "front", "rear"]
        ops_found = sum(1 for o in op_list if o in student_text.lower())
        if ops_found >= 2:
            weighted = min(1.0, weighted + 0.1)

    awarded = round(max_marks * weighted, 1)
    awarded = min(max_marks, max(0.0, awarded))

    if weighted >= 0.85:
        reason_tier = "excellent"
    elif weighted >= 0.65:
        reason_tier = "good"
    elif weighted >= 0.4:
        reason_tier = "partial"
    else:
        reason_tier = "weak"

    reasons = []
    if refs_for_criterion:
        reasons.append(f"Semantic match {round(sim_score * 100)}% to relevant reference content.")
    if kw:
        reasons.append(f"Keywords coverage {round(kw_score * 100)}%.")
    reasons.append(f"Development strength: {reason_tier}.")

    if reason_tier == "excellent":
        reason = f"Strong coverage of '{name}'. " + " ".join(reasons)
    elif reason_tier == "good":
        reason = f"Good explanation of '{name}', room for more depth. " + " ".join(reasons)
    elif reason_tier == "partial":
        reason = f"Partial coverage of '{name}'. Expand with more detail and correct terminology. " + " ".join(reasons)
    else:
        reason = f"Minimal coverage of '{name}'. Review definitions and key concepts thoroughly. " + " ".join(reasons)

    return awarded, reason, weighted


def evaluate_answer(request: EvaluateAnswerRequest) -> EvaluateAnswerResponse:
    reference_text = (request.referenceAnswer or "").strip()
    student_text = request.get_student_text().strip()
    criteria = request.get_criteria()
    question = (request.question or "").strip()

    if not student_text:
        return EvaluateAnswerResponse(
            totalMarks=0.0,
            maxMarks=sum(c.get_max_marks() for c in criteria) or 0,
            criteria=[
                CriterionResult(name=c.get_name(), maxMarks=c.get_max_marks(), awardedMarks=0.0,
                                reason="No answer text provided.")
                for c in criteria
            ],
            feedback="No answer was provided for this question.",
            semanticSimilarity=0.0,
            _fallback=True,
        )

    overall_sim, used_fallback_sim = sentence_level_similarity(reference_text, student_text)
    overall_sim = round(overall_sim, 4)

    if not criteria:
        max_marks = 10
        awarded = round(max_marks * overall_sim, 1)
        return EvaluateAnswerResponse(
            totalMarks=awarded,
            maxMarks=max_marks,
            criteria=[
                CriterionResult(
                    name="Overall Understanding",
                    maxMarks=max_marks,
                    awardedMarks=awarded,
                    reason=f"Overall semantic similarity to reference answer is {round(overall_sim * 100)}%.",
                )
            ],
            feedback=f"Overall similarity score: {round(overall_sim * 100)}%.",
            semanticSimilarity=overall_sim,
            _fallback=used_fallback_sim,
        )

    criterion_weights = {}
    max_total = sum(c.get_max_marks() for c in criteria)

    results: List[CriterionResult] = []
    total_awarded = 0.0

    for criterion in criteria:
        awarded, reason, raw_weight = _assess_criterion(
            criterion, student_text, reference_text, overall_sim, criterion_weights
        )
        total_awarded += awarded
        results.append(
            CriterionResult(
                name=criterion.get_name(),
                maxMarks=criterion.get_max_marks(),
                awardedMarks=awarded,
                reason=reason,
            )
        )

    total_awarded = round(total_awarded, 1)
    total_awarded = min(max_total, max(0.0, total_awarded))
    pct = total_awarded / max_total if max_total > 0 else 0

    feedback_parts = []
    feedback_parts.append(f"Semantic similarity with reference: {round(overall_sim * 100)}%.")
    word_count = _count_words(student_text)
    ref_word_count = _count_words(reference_text)
    feedback_parts.append(f"Answer length: {word_count} words (reference: {ref_word_count}).")

    weak_criteria = [r for r in results if (r.awardedMarks / max(1, r.maxMarks)) < 0.5]
    if weak_criteria:
        names = ", ".join(w.name for w in weak_criteria)
        feedback_parts.append(f"Needs improvement on: {names}.")

    strong_criteria = [r for r in results if (r.awardedMarks / max(1, r.maxMarks)) >= 0.85]
    if strong_criteria:
        names = ", ".join(s.name for s in strong_criteria)
        feedback_parts.append(f"Excellent work on: {names}.")

    if pct >= 0.85:
        summary = "Outstanding answer demonstrating strong comprehension."
    elif pct >= 0.7:
        summary = "Solid answer. Refine the weaker criteria for full marks."
    elif pct >= 0.5:
        summary = "Satisfactory attempt. Multiple criteria need deeper coverage."
    else:
        summary = "Answer is significantly below expectations. Restudy the topic and try again."
    feedback_parts.append(summary)

    return EvaluateAnswerResponse(
        totalMarks=total_awarded,
        maxMarks=max_total,
        criteria=results,
        feedback=" ".join(feedback_parts),
        semanticSimilarity=overall_sim,
        _fallback=used_fallback_sim,
    )
