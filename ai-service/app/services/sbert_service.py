import os
import re
import math
import logging
from typing import List, Optional, Tuple
from collections import Counter

from .config import settings

logger = logging.getLogger(__name__)

_sbert_model = None
_sbert_loaded = False
_nltk_available = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity as sk_cosine
    _sklearn_ok = True
except ImportError:
    _sklearn_ok = False
    logger.warning("scikit-learn not available, using basic similarity fallback")


def _load_sbert():
    global _sbert_model, _sbert_loaded
    if _sbert_loaded:
        return _sbert_model
    if settings.use_mock_mode:
        _sbert_loaded = True
        return None
    try:
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading SBERT model: {settings.sbert_model}")
        _sbert_model = SentenceTransformer(
            settings.sbert_model,
            cache_folder=settings.model_cache_dir,
            device="cpu",
        )
        _sbert_loaded = True
        logger.info("SBERT model loaded successfully")
        return _sbert_model
    except Exception as e:
        logger.warning(f"Failed to load SBERT model: {e}. Using heuristic fallback.")
        _sbert_loaded = True
        _sbert_model = None
        return None


def _preprocess(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _tokenize(text: str) -> List[str]:
    stopwords = {
        "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "need", "dare", "ought",
        "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
        "as", "into", "through", "during", "before", "after", "above", "below",
        "between", "out", "off", "over", "under", "again", "further", "then",
        "once", "here", "there", "when", "where", "why", "how", "all", "each",
        "every", "both", "few", "more", "most", "other", "some", "such", "no",
        "nor", "not", "only", "own", "same", "so", "than", "too", "very",
        "just", "because", "but", "and", "or", "if", "while", "about", "against",
        "it", "its", "this", "that", "these", "those", "i", "you", "he", "she",
        "we", "they", "them", "their", "what", "which", "who", "whom",
    }
    tokens = _preprocess(text).split()
    return [t for t in tokens if t not in stopwords and len(t) > 1]


def _jaccard_similarity(set1: set, set2: set) -> float:
    if not set1 and not set2:
        return 1.0
    if not set1 or not set2:
        return 0.0
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    return intersection / union if union > 0 else 0.0


def _cosine_tf(tokens1: List[str], tokens2: List[str]) -> float:
    if not tokens1 or not tokens2:
        return 0.0
    c1 = Counter(tokens1)
    c2 = Counter(tokens2)
    all_words = set(c1.keys()) | set(c2.keys())
    if not all_words:
        return 0.0
    v1 = [c1.get(w, 0) for w in all_words]
    v2 = [c2.get(w, 0) for w in all_words]
    dot = sum(a * b for a, b in zip(v1, v2))
    m1 = math.sqrt(sum(a * a for a in v1))
    m2 = math.sqrt(sum(b * b for b in v2))
    if m1 == 0 or m2 == 0:
        return 0.0
    return dot / (m1 * m2)


def _tfidf_similarity(text1: str, text2: str) -> float:
    if not _sklearn_ok:
        return None
    try:
        t1, t2 = _preprocess(text1), _preprocess(text2)
        if not t1 or not t2:
            return 0.0
        vec = TfidfVectorizer(ngram_range=(1, 2))
        tfidf = vec.fit_transform([t1, t2])
        sim = sk_cosine(tfidf[0], tfidf[1])[0][0]
        return float(sim)
    except Exception as e:
        logger.debug(f"TF-IDF similarity failed: {e}")
        return None


def compute_similarity(text1: str, text2: str) -> Tuple[float, bool]:
    if not text1 or not text2:
        return 0.0, True

    model = _load_sbert()
    if model is not None:
        try:
            embeddings = model.encode([text1, text2], convert_to_numpy=True)
            e1, e2 = embeddings[0], embeddings[1]
            norm1 = math.sqrt(sum(x * x for x in e1))
            norm2 = math.sqrt(sum(x * x for x in e2))
            if norm1 > 0 and norm2 > 0:
                sim = float(sum(a * b for a, b in zip(e1, e2)) / (norm1 * norm2))
                return max(0.0, min(1.0, sim)), False
        except Exception as e:
            logger.warning(f"SBERT encoding failed: {e}")

    tfidf_sim = _tfidf_similarity(text1, text2)
    tokens1, tokens2 = _tokenize(text1), _tokenize(text2)
    set1, set2 = set(tokens1), set(tokens2)
    jaccard = _jaccard_similarity(set1, set2)
    cosine = _cosine_tf(tokens1, tokens2)

    if tfidf_sim is not None:
        final = 0.55 * tfidf_sim + 0.25 * cosine + 0.20 * jaccard
    else:
        final = 0.55 * cosine + 0.45 * jaccard
    return max(0.0, min(1.0, final)), True


def sentence_level_similarity(reference: str, student: str) -> Tuple[float, bool]:
    ref_sents = re.split(r"[.!?]+", reference)
    stu_sents = re.split(r"[.!?]+", student)
    ref_sents = [s.strip() for s in ref_sents if len(s.strip()) > 3]
    stu_sents = [s.strip() for s in stu_sents if len(s.strip()) > 3]

    if not ref_sents or not stu_sents:
        return compute_similarity(reference, student)

    matched_scores = []
    used_stu = set()
    any_real = False

    for rs in ref_sents:
        best = 0.0
        for i, ss in enumerate(stu_sents):
            if i in used_stu:
                continue
            sim, fallback = compute_similarity(rs, ss)
            if not fallback:
                any_real = True
            if sim > best:
                best = sim
                best_idx = i
        if best > 0.35:
            matched_scores.append(best)
            if "best_idx" in locals():
                used_stu.add(best_idx)

    if not matched_scores:
        sim, fb = compute_similarity(reference, student)
        return sim, (fb and not any_real)

    recall = len(matched_scores) / len(ref_sents)
    precision = len(matched_scores) / max(1, len(stu_sents))
    avg_sim = sum(matched_scores) / len(matched_scores)
    f1 = 0.0
    if precision + recall > 0:
        f1 = 2 * precision * recall / (precision + recall)
    final = 0.6 * avg_sim + 0.4 * f1
    return max(0.0, min(1.0, final)), not any_real


def keyword_coverage(keywords_str: Optional[str], text: str) -> float:
    if not keywords_str:
        return 0.5
    keywords = [k.strip().lower() for k in re.split(r"[\s,;]+", keywords_str) if k.strip()]
    if not keywords:
        return 0.5
    t = text.lower()
    found = sum(1 for k in keywords if k in t)
    return found / len(keywords)
