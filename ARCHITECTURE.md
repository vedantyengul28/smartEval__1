# SmartEval Architecture

This document details the system architecture, responsibilities of each layer, and how components communicate.

## 1. Layers & Service Boundaries

SmartEval follows a **modular monolith with a separate AI service**. The Node backend is a layered monolith (routes → controllers → services → pg/redis). The Python AI service is independently deployable and exposes only AI primitives (OCR, semantic similarity, rubric evaluation).

```
 ┌──────────────────────────────────────────────────────────────────┐
 │  React Frontend (Vite + Tailwind + Monaco)                       │
 │  ├─ Pages / Layouts / Components                                 │
 │  ├─ Axios services (api.js, auth.js, assessments.js, ...)        │
 │  └─ Context providers (Auth, Toast)                              │
 └───────────────────────────────┬──────────────────────────────────┘
                                 │ HTTPS (CORS allowed list)
                                 ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │  Node.js + Express Backend                                       │
 │                                                                  │
 │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
 │  │ Middleware │  │ Controllers  │  │ Services (business logic) │ │
 │  │ auth       │  │ (thin)       │  │                          │ │
 │  │ error      │  │              │  │ authService              │ │
 │  │ upload     │  │              │  │ assessmentService        │ │
 │  │ rate-limit │  │              │  │ questionService          │ │
 │  └────────────┘  └──────────────┘  │ submissionService        │ │
 │                                   │ evaluationService (orchestrator)
 │  Routes:                          │ aiServiceClient           │ │
 │   /api/auth                       │ judge0Service             │ │
 │   /api/assessments                └──────────────────────────┘ │
 │   /api/questions                       │            │          │
 │   /api/submissions (/evaluations/*)   │            │          │
 │   /api/code                           │            │          │
 └───────────────────────────────────────┼────────────┼──────────┘
                                         │            │
                               Postgres◄─┘            └─► Redis
                            (truth store)           (cache / TTL)

                                         │
                                         ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │  Python FastAPI — AI Service  (AI_USE_MOCK_MODE by default)     │
 │                                                                  │
 │  /ai/health                 liveness + models loaded             │
 │  /ai/ocr                    TrOCR (or mock) → extracted text     │
 │  /ai/semantic-similarity    SBERT cosine / TF-IDF / Jaccard     │
 │  /ai/evaluate-answer        rubric engine → criterion marks + fb│
 │                                                                  │
 │  ┌─────────────────┐      ┌─────────────────┐                    │
 │  │ sbert_service   │      │ trocr_service   │                    │
 │  │ (heuristic TF-  │      │ (pdfium → image │                    │
 │  │  IDF + fallback │      │  → TrOCR / mock)│                    │
 │  └────────┬────────┘      └────────┬────────┘                    │
 │           └───────┬───────────────┘                             │
 │                   ▼                                             │
 │         evaluation_engine.py (rubric-based scoring)             │
 └──────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                              Judge0 CE (public or self-hosted)
                              Programming language executors
                              submission tokens → results
```

## 2. Request Flow: Subjective Answer Evaluation

An end-to-end trace of a single subjective answer:

```
Student → React submit button (StudentAttempt)
          ↓ axios POST /api/submissions (multipart)
Node      → upload middleware saves file
          → submissionService.createSubmission stores row in:
               submissions, subjective_answers (text + file path)
Teacher clicks "Run AI Evaluation"
          ↓ POST /api/submissions/evaluations/{id}/evaluate
evaluationService.evaluateSubmission
  for each subjective question:
    1. DB fetch answer + uploaded_file_path
    2. If file → aiService.ocrImage(filePath)  [POST /ai/ocr]
         - pypdfium2 renders PDF pages → PIL images
         - TrOCR (or mock) → extractedText persisted
    3. questionId → questionService.getById(includeDetails=true)
         - rubric, criteria, keywords, reference_answer
    4. aiService.evaluateAnswer(question, reference, studentText, criteria)
         - SBERT sentence-level similarity between each reference sentence
         - per-criterion keyword coverage, length heuristics
         - weighted marks per criterion, reason string generated
    5. transactional write:
         evaluations.status = 'completed'
         evaluation_criteria rows (name, max/awarded, reason)
         feedback row
         submissions.total_marks_awarded updated
Teacher opens review modal → PUT reviews, updates criteria marks → DB write
Teacher clicks "Approve" → marks approved → results table row inserted + visible to student.
```

## 3. Request Flow: Programming Evaluation

```
Student (Monaco editor) → "Run" button.
                          ↓ POST /api/code/submit
Node judge0Service.runTestCases(question.testCases visible only)
  For each: POST /submissions → waitForCompletion via GET tokens loop
  Aggregate per-case marks → returned to UI live
Student final "Submit Assessment" →
  submissionService writes programming_submissions.source_code + lang
Teacher Run Evaluation →
  evaluationService.evaluateProgramming per question
    judge0Service.runTestCases (ALL including hidden)
    write test_case_results, evaluations, marks
    proceed to teacher review / approval as above
```

## 4. Caching Strategy (Redis)

| Key pattern | TTL | Purpose | Writer invalidates |
|---|---|---|---|
| `assessment:{id}` | 10 min | Detail view including questions | any update |
| `assessments:list:teacher:{id}:*` | 10 min | Teacher list filtered by status | create/update/delete/publish |
| `assessments:list:student:{id}` | 10 min | Student published assessments list | publish, create submission |
| `question:{id}:*` | 10 min | Question detail + rubric/test cases | rubric + test-case writes |
| `eval:status:{submissionId}` | 30 min | In-progress evaluation status | on evaluate completion |

The cache is **best-effort only**; DB always wins. Use redis-cli `FLUSHDB` when needed.

## 5. Security Boundaries

| Concern | Where implemented |
|---|---|
| Password hashing | `authService.hashPassword()` — bcrypt, 10 rounds |
| JWT mint & verify | `middleware/auth.js` — jsonwebtoken (`HS256`), `JWT_SECRET` env |
| Role gates | `requireTeacher` / `requireStudent` middleware + front-end route guards |
| Input validation | Zod schemas in `utils/validators.js` before hitting services |
| CORS | Origins whitelist via `CORS_ORIGIN` env |
| Rate limiting | Global `/api/*` limit (100 req / 15 min window) |
| File validation | Multer limits + extension/mime check (`uploads/`) |
| Arbitrary code safety | **Never executed on Node backend.** All code sent only to Judge0 execution environment. |

## 6. Separation of AI Concerns

The Python service is intentionally stateless and side-effect-free:

- It **never** talks directly to Postgres/Redis — it accepts HTTP inputs and returns marks.
- It **never** exposes student data over logging beyond request IDs.
- The Node evaluation service is the **single source of truth** for storing/versioning evaluations and running transactions across `evaluations`, `evaluation_criteria`, `feedback`, `results`.
- If AI is unavailable, `evaluationService.fallbackEvaluate()` runs a deterministic keyword + overlap heuristic in Node (keeps pipeline runnable for demos).

This separation also lets you scale: evaluate batch jobs in Python workers independently of user-facing Express latency.

## 7. Horizontal Scaling Notes (not required for MVP)

- **Backend**: stateless; put behind nginx/ALB, share Postgres + Redis.
- **AI Service**: CPU-heavy — run behind gunicorn/uvicorn workers, GPU-enabled where required.
- **Judge0**: self-hosted cluster with multiple workers, dedicated queues per language.
