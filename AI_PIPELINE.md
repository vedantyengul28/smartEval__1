# SmartEval — AI Evaluation Pipeline

SmartEval delegates **subjective answer evaluation** and **handwritten OCR** to a
dedicated Python FastAPI service (module `ai-service/`). The Node backend never runs
ML inference itself. It:

1. Prepares input (reference answer, student answer, rubric)
2. Calls the AI service over HTTP (endpoints documented below)
3. Persists the response into `evaluations` / `evaluation_criteria` / `feedback`
4. Allows a teacher to override the AI's marks and approve them.

> **Important principle (per spec §7).** SBERT similarity is **one input** into the
> evaluation engine, never the final score. The final mark is always produced by a
> **rubric-based scorer** that assesses each criterion individually.

This doc walks through:

1. Endpoints exposed by the AI service
2. How OCR (TrOCR) extracts text from handwritten uploads
3. How the semantic similarity ensemble works (SBERT, TF-IDF, Jaccard)
4. How the rubric-based Evaluation Engine combines similarity with criterion keywords
   to produce per-criterion marks, reasons, and overall feedback
5. The **mock/fallback mode** for developers running on machines without enough RAM / GPU.

---

## 1. FastAPI endpoints

All endpoints live under `http://<AI_HOST>:<AI_PORT>/`. The default dev URL is
`http://localhost:5050`.

### 1.1 `GET /ai/health`

Liveness probe. Returns the status of SBERT and TrOCR loaders and `mock_mode` flag.

```json
{
  "status": "ok",
  "mock_mode": true,
  "sbert": {
    "ready": true,
    "model": "fallback-tfidf+jaccard",
    "note": "Set AI_USE_MOCK_MODE=false to try loading sentence-transformers"
  },
  "trocr": {
    "ready": true,
    "model": "mock-filename-based",
    "note": "TrOCR model not loaded in mock mode"
  },
  "time": "2025-03-18T12:34:56.789Z"
}
```

### 1.2 `POST /ai/ocr`

Transcribe a handwritten answer image / PDF into plain text.

**Request** (`multipart/form-data`):

| Field  | Type             | Description                                                     |
| ------ | ---------------- | --------------------------------------------------------------- |
| `file` | PNG / JPG / PDF  | The handwritten scan. PDF multi-page uses page 1 only for now. |

**Response (200)**

```json
{
  "text": "A stack is a LIFO data structure. Real life example: back button. ...",
  "source": "trocr" | "mock" | "fallback-pdfminer",
  "processingMs": 412,
  "note": "Mock mode: returned filename-keyed template. Enable real TrOCR with AI_USE_MOCK_MODE=false."
}
```

**Failures:** `400` (unsupported mime / corrupt PDF), `500` (OCR pipeline crash — returns
`text: ""` plus `error` field for client side UX).

### 1.3 `POST /ai/semantic-similarity`

Raw similarity-only endpoint. Useful for debugging or for building UIs that preview
similarity before a full evaluation.

**Request**

```json
{
  "text_a": "A stack is a LIFO data structure with push/pop operations.",
  "text_b": "A stack is a last-in first-out structure. It supports push and pop."
}
```

**Response (200)**

```json
{
  "similarity": 0.912,
  "method": "ensemble:sbert*0.6+tfidf*0.25+jaccard*0.15",
  "components": {
    "sbert": 0.92,
    "tfidf_cosine": 0.87,
    "jaccard": 0.81
  },
  "mock_mode": true
}
```

### 1.4 `POST /ai/evaluate-answer`

The main endpoint Node calls. Produces **per-criterion marks**, **reasons**, a
**total**, and **feedback**.

**Request**

```json
{
  "question_type": "subjective_text" | "subjective_handwritten",
  "question_text": "Define a stack and give one real-world example.",
  "reference_answer": "A stack is a LIFO data structure. Example: browser back button.",
  "student_answer": "A stack is a last-in first-out data structure. Operations: push adds, pop removes the top element. Real-life example: browser back button.",
  "max_marks": 10,
  "rubric": {
    "instructions": "Full marks only when both definition AND example are correct.",
    "criteria": [
      { "id": 10, "name": "Definition",   "description": "LIFO + push/pop mentioned",   "maximum_marks": 2, "keywords": ["LIFO","last-in-first-out","push","pop"] },
      { "id": 11, "name": "Explanation",  "description": "Operations & behaviour",     "maximum_marks": 3, "keywords": [] },
      { "id": 12, "name": "Key concepts", "description": "Time complexity, usage",     "maximum_marks": 3, "keywords": ["O(1)","constant","undo","back"] },
      { "id": 13, "name": "Example",      "description": "A concrete example",         "maximum_marks": 2, "keywords": ["back","undo","plates","recursion"] }
    ]
  }
}
```

**Response (200)**

```json
{
  "totalMarks": 8.5,
  "maxMarks": 10,
  "overallSimilarity": 0.92,
  "aiModelVersion": "mock/v1" | "paraphrase-MiniLM-L6-v2+trocr-base",
  "criteria": [
    {
      "rubricCriterionId": 10,
      "name": "Definition",
      "maxMarks": 2,
      "awardedMarks": 2,
      "similarity": 0.98,
      "keywordMatch": 1.0,
      "reason": "Mentions LIFO, last-in first-out, push and pop — all keywords present."
    },
    {
      "rubricCriterionId": 11,
      "name": "Explanation",
      "maxMarks": 3,
      "awardedMarks": 2,
      "similarity": 0.88,
      "keywordMatch": 0.66,
      "reason": "Behaviour explained but time complexity of operations not mentioned."
    },
    {
      "rubricCriterionId": 12,
      "name": "Key concepts",
      "maxMarks": 3,
      "awardedMarks": 2.5,
      "similarity": 0.9,
      "keywordMatch": 0.75,
      "reason": "Mentions browser back/undo pattern. O(1) not explicitly stated."
    },
    {
      "rubricCriterionId": 13,
      "name": "Example",
      "maxMarks": 2,
      "awardedMarks": 2,
      "similarity": 1.0,
      "keywordMatch": 1.0,
      "reason": "Browser back button given — matches the reference example."
    }
  ],
  "feedback": "Well written answer covering most aspects of stacks. You correctly describe LIFO behaviour and list push/pop. The browser-back example is excellent. To score full marks, explicitly state that each operation is O(1) and maybe mention an additional use case.",
  "processingMs": 41,
  "mockMode": true
}
```

---

## 2. OCR pipeline (TrOCR flow)

```
User upload (PNG/JPG/PDF)
        │
        ▼
 Multer validates MIME + size (<MAX_UPLOAD_MB).
 (invalid ➜ 400/413/415 — nothing persisted)
        │
        ▼
 File streamed to: UPLOADS_ROOT / submissions / <submissionId> / <questionId>.<ext>
        │
        ▼
 Teacher clicks "Evaluate"  →  POST /api/submissions/:id/evaluate
        │
        ▼
 Node backend reads handwritten_file_path for each subjective_handwritten answer.
        │
        ▼
 POST /ai/ocr (multipart) to FastAPI
        │
 ┌──────┴────────────────────────────────────────────┐
 │  MOCK MODE (AI_USE_MOCK_MODE=true, default):      │
 │    - For PNG/JPG: generate deterministic          │
 │      "template text" keyed on filename stem       │
 │      (so repeated runs are stable for demos).     │
 │    - For PDF: extract with pypdf/pdfminer if      │
 │      installed, otherwise same mock behaviour.    │
 │                                                    │
 │  REAL MODE:                                        │
 │    - PIL or pdf2image → per-page images            │
 │    - processor = ViTImageProcessor.from_pretrained │
 │      ("microsoft/trocr-base-handwritten")         │
 │    - model = VisionEncoderDecoderModel.from_...   │
 │    - Greedy decode per line → concatenated text    │
 └────────────────────────────────────────────────────┘
        │
        ▼
 Returned text stored in `subjective_answers.ocr_extracted_text`
 + ocr_status = "processed" | "failed: <reason>"
        │
        ▼
 Text preprocessing (§3) → passed to evaluate-answer as student_answer
```

Where the real HuggingFace TrOCR model would be loaded is isolated in
`ai-service/app/services/trocr.py:TrOCRService._load_real_model()` so swapping back
in is a single boolean flag change.

---

## 3. Text preprocessing

Both reference and student answers pass through a deterministic preprocessor:

1. Unicode NFC normalization
2. Lower-case
3. Strip LaTeX / Markdown fences that are irrelevant for similarity
4. Expand common contractions (Python → `contractions` library or built-in map fallback)
5. Remove excessive whitespace, normalize line endings
6. Optional: remove stopwords (skipped for SBERT, used for TF-IDF/Jaccard)

The `preprocess(text, aggressive=False)` helper is in `evaluation_engine.py`.

---

## 4. Semantic similarity ensemble

We combine three independent signals so that any single model failure or blind spot
cannot produce an absurdly wrong score:

| Signal                            | Weight | Mock-mode substitute                                   |
| --------------------------------- | ------ | ------------------------------------------------------ |
| **SBERT cosine similarity**       | 60%    | TF-IDF + TruncatedSVD(128) → cosine on reference corpus |
| **TF-IDF cosine (sklearn)**       | 25%    | Same — always on                                       |
| **Jaccard keyword overlap**       | 15%    | Same — always on                                       |

The final `overallSimilarity` is:

```
overall = 0.60 * sbert + 0.25 * tfidf + 0.15 * jaccard
```

### 4.1 SBERT (real model)

```python
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("paraphrase-MiniLM-L6-v2")   # ~80 MB, CPU friendly
emb_ref, emb_stu = model.encode([ref, ans], normalize_embeddings=True)
sbert = float(emb_ref @ emb_stu.T)
```

### 4.2 SBERT (fallback in mock mode)

Mock-mode **does not skip SBERT silently**. It replaces the model with a deterministic
substitute that is behaviorally analogous:

1. Build a tiny in-memory corpus = `[ref_answer, stu_answer] + each criterion.description + each criterion.keywords`.
2. Train a `TfidfVectorizer` on this corpus.
3. Reduce with `TruncatedSVD(n_components=min(128, vocab))`.
4. Compute L2-normalized vectors and dot product.

This gives a genuinely semantic-ish score that correlates with lexical + structural
overlap, while being fully reproducible on any machine.

### 4.3 TF-IDF cosine (always on)

Same vectorizer as above but applied directly to the two strings (reference + student)
using the per-assessment corpus of question_text + reference_answer as the fit set.

### 4.4 Jaccard (always on)

```
J(student, criterion / reference) = |S ∩ R| / |S ∪ R|
```
where R is the set of tokens in the criterion description/keywords (or reference
answer), and S the student answer tokens (stopwords filtered).

---

## 5. Rubric-based Evaluation Engine (score → awarded marks)

For each rubric criterion, `EvaluationEngine._assess_criterion()` produces a score in
`[0, 1]` and then multiplies by `maximum_marks`, quantized to **0.5-mark precision** so
marks look human.

Inputs per criterion:

- `criterion.description` (what the grader looks for)
- `criterion.keywords` (optional `TEXT[]` from rubric_criteria table)
- `reference_answer` (whole)
- `student_answer` (whole)

Steps:

1. **Slicing:** Build a criterion-level "expected text" by concatenating
   `description + " " + " ".join(keywords)` plus a window of 2 sentences around the
   first keyword match inside the reference answer (if any). Call this `expected_text`.
2. **Per-criterion similarity:** run the §4 ensemble on `(expected_text, student_answer)`
   → `sim ∈ [0, 1]`.
3. **Keyword score `kw`:** `#hits / #keywords` (0 if keywords = empty, clamped to avoid
   overweighting — never contributes more than 40% of the final criterion score).
4. **Coverage `cov`:** fraction of unique lemma tokens in `expected_text` that appear in
   the student answer (Jaccard-style but asymmetric).
5. **Combine:**
   ```
   raw = 0.55 * sim + 0.25 * kw + 0.20 * cov
   ```
   where each weight is documented and overridable via `AI_*_WEIGHT` env vars.
6. **Quantize:**
   ```
   awarded = round(raw * maximum_marks * 2) / 2
   awarded = max(0, min(maximum_marks, awarded))
   ```
7. **Reason generation (rule-based):** Produce a short English sentence explaining the
   mark, e.g.:
   - "All 3 keywords present and full description covered → full marks (2/2)."
   - "Missing {`O(1)`, `constant`} → partial (2.5/3)."
   - "No overlap with criterion definition → 0/2."
8. **Overall feedback generation:** Concatenate per-criterion bullet points and append
   1-2 summarizing sentences using a lightweight template engine + the top-2 missed
   keywords across all criteria. Feedback is deterministic so demos are stable.

### 5.1 Why not just SBERT * max_marks?

- Similarity scores are **not marks**. A student might parrot the reference answer with
  99% similarity but completely fail to answer a specific sub-criterion the rubric
  weights at 40%.
- Rubric-based scoring is auditable (per-criterion `reason`), teacher-overridable, and
  maps cleanly to what academic markers *actually do*.
- The teacher can always edit `awardedMarksFinal` in the UI — the AI is a **first pass**,
  not a judge.

---

## 6. Node-side fallback evaluation

If the Python service is unreachable (Docker not started, port wrong, etc.) the Node
backend falls back to `evaluationService.fallbackEvaluate()`, which reimplements the
smallest useful subset of §4 + §5 using pure JavaScript (Jaccard, TF-IDF-ish bag of
words, same quantization). This guarantees the end-to-end demo works even if the AI
container fails to start.

Fallback evaluations are clearly labeled:

- `evaluations.evaluated_by_ai = false`
- `evaluations.ai_model_version = "nodejs-local-fallback/v1"`

---

## 7. Mock mode vs real mode flip

Toggle everything via **two env vars** (no code changes):

| Env var                     | Value           | Behaviour                                            |
| --------------------------- | --------------- | ---------------------------------------------------- |
| `AI_USE_MOCK_MODE`          | `true` (default)| TrOCR + SBERT use deterministic fallbacks. No HF models downloaded. Startup instant. |
| `AI_USE_MOCK_MODE`          | `false`         | Try to load `microsoft/trocr-base-handwritten` (~1.5 GB) and `paraphrase-MiniLM-L6-v2` (~80 MB). Falls back to mock per-model on load failure. |
| `JUDGE0_USE_PUBLIC_CE`      | `true`          | Use `https://ce.judge0.com` (no local Judge0 needed). |
| `JUDGE0_USE_PUBLIC_CE`      | `false`         | Use `JUDGE0_API_URL` from `.env`.                     |

All mock / fallback paths are documented with log messages at the **INFO** level so
the evaluator can confirm which mode is active during a demo.
