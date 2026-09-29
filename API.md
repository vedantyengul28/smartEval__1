# SmartEval — REST API Reference

All endpoints are served by the **Node.js + Express** backend on the path prefix
configured by `BACKEND_PORT` (default `http://localhost:4000`). Authentication is via
JWT bearer tokens issued by `/api/auth/login` / `/api/auth/register`.

- **Auth header:** `Authorization: Bearer <token>`
- **Request/Response content-type:** `application/json` (unless explicitly multipart)
- **Error shape:** All application errors return JSON of the form
  `{ "success": false, "error": { "code": "...", "message": "...", "details": {} } }`
  with sensible HTTP status codes.

> 📘 Python FastAPI AI service endpoints used **internally by the backend** are
> documented separately in `AI_PIPELINE.md`. Clients never talk to the AI service
> directly.

---

## 1. Authentication (`/api/auth`)

### 1.1 `POST /api/auth/register`

Create a new teacher or student account. Password is hashed with bcrypt before insert.

**Auth:** Public.

**Request body**

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "email": "ada@uni.edu",
  "password": "Str0ng!Pass",
  "role": "teacher"
}
```

| Field        | Type   | Required | Allowed values      |
| ------------ | ------ | -------- | ------------------- |
| `firstName`  | string | ✅       | 1–120 chars         |
| `lastName`   | string | ✅       | 1–120 chars         |
| `email`      | string | ✅       | Valid email, unique |
| `password`   | string | ✅       | ≥ 8 chars           |
| `role`       | string | ✅       | `teacher`, `student`|

**Response (201)**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "token": "<jwt>",
    "user": { "id": 42, "email": "ada@uni.edu", "role": "teacher", "firstName": "Ada", "lastName": "Lovelace" }
  }
}
```

**Common failures:** `409 CONFLICT` (email already registered), `400 BAD REQUEST` (validation).

---

### 1.2 `POST /api/auth/login`

Verify email + password and issue a JWT (expires per `JWT_EXPIRES_IN`).

**Auth:** Public.

**Request body**

```json
{ "email": "teacher@example.com", "password": "password123" }
```

**Response (200)**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<jwt>",
    "user": { "id": 1, "email": "teacher@example.com", "role": "teacher", "firstName": "Demo", "lastName": "Teacher" }
  }
}
```

**Common failures:** `401 UNAUTHORIZED` (email unknown or password mismatch).

---

### 1.3 `POST /api/auth/me`

Decode the JWT in the `Authorization` header and return the resolved user record.
Useful to rehydrate the React app on page reload.

**Auth:** Any authenticated user.

**Request:** Empty. **Response (200):** Same shape as login's `data.user`.

---

## 2. Assessments (`/api/assessments`)

### 2.1 `GET /api/assessments`

List assessments visible to the caller.

- **Teachers** → every assessment they created, filtered by optional query params.
- **Students** → only `status=published` assessments.

**Query:** `?status=published`, `?course_code=CS101` (optional).

**Auth:** Authenticated.

**Response (200)**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "CS101 Midterm",
      "description": "...",
      "courseCode": "CS101",
      "totalMarks": 30,
      "durationMinutes": 90,
      "status": "published",
      "startTime": "2025-04-01T09:00:00Z",
      "endTime": "2025-04-30T23:59:00Z",
      "questionCount": 2,
      "createdAt": "..."
    }
  ]
}
```

---

### 2.2 `POST /api/assessments`

Create a new **draft** assessment owned by the calling teacher.

**Auth:** Teacher only.

**Request body**

```json
{
  "title": "CS101 Final Exam",
  "description": "All topics covered in DS&A.",
  "courseCode": "CS101",
  "durationMinutes": 120,
  "startTime": "2025-05-01T09:00:00Z",
  "endTime":   "2025-05-01T11:00:00Z"
}
```

**Response (201):** Same shape as `GET /:id` below.

---

### 2.3 `GET /api/assessments/:id`

Fetch a single assessment with basic stats and teacher info.

**Auth:** Teacher (owner) OR Student (assessment must be published).

**Response (200)**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "...",
    "...": "...",
    "questions": [ /* compact list */ ],
    "stats": {
      "submissionCount": 12,
      "evaluatedCount": 8,
      "approvedCount": 7,
      "averagePercentage": 71.4
    }
  }
}
```

---

### 2.4 `PUT /api/assessments/:id`

Update any field on a draft or published assessment. Cannot change ownership.

**Auth:** Owner teacher only.

**Body:** Same fields as `POST`. All fields optional.

**Response (200):** Updated assessment.

---

### 2.5 `DELETE /api/assessments/:id`

Soft/hard delete: **hard deletes** the assessment and all child rows (questions,
rubrics, test-cases, submissions, evaluations) via FK cascade.

**Auth:** Owner teacher only. **Response (204).**

---

### 2.6 `POST /api/assessments/:id/publish`

Move an assessment from `draft` → `published` (validates that it has ≥ 1 question,
each subjective question has a rubric, each programming question has ≥ 1 test case,
and per-question `max_marks` equals sum of criteria marks / test case marks).

**Auth:** Owner teacher only. **Response (200).**

---

## 3. Questions (`/api/questions`)

All endpoints under `/api/questions` are **teacher only**, since questions are an
authoring primitive. Students see questions via the assessment attempt page.

### 3.1 `POST /api/questions`

Create a question attached to an assessment.

**Request body**

```json
{
  "assessmentId": 1,
  "position": 2,
  "type": "subjective_text",
  "text": "Define a stack and give one real-world example.",
  "maxMarks": 10,
  "referenceAnswer": "A stack is a LIFO data structure. Example: browser back button.",
  "rubric": {
    "instructions": "Award full marks only when both definition AND example are correct.",
    "criteria": [
      { "name": "Definition",   "description": "LIFO + push/pop mentioned", "maximumMarks": 2, "keywords": ["LIFO","last-in-first-out","push","pop"] },
      { "name": "Explanation",  "description": "Operations & behaviour",   "maximumMarks": 3, "keywords": [] },
      { "name": "Key concepts", "description": "Time complexity, usage",   "maximumMarks": 3, "keywords": ["O(1)","constant","undo","back"] },
      { "name": "Example",      "description": "A concrete example",       "maximumMarks": 2, "keywords": ["back","undo","plates","recursion"] }
    ]
  }
}
```

For a programming question the body looks like:

```json
{
  "assessmentId": 1,
  "type": "programming",
  "text": "Write a Python function reverse_arr(arr) that returns the array reversed, in place.",
  "maxMarks": 20,
  "programmingLanguage": "python",
  "boilerplateCode": "def reverse_arr(arr):\n    pass\n",
  "timeLimitSeconds": 3,
  "testCases": [
    { "position": 1, "inputData": "[1,2,3]\n", "expectedOutput": "[3, 2, 1]\n", "marks": 5, "visibility": "public" },
    { "position": 2, "inputData": "[]\n",      "expectedOutput": "[]\n",          "marks": 5, "visibility": "public" },
    { "position": 3, "inputData": "[7]\n",     "expectedOutput": "[7]\n",         "marks": 5, "visibility": "hidden" },
    { "position": 4, "inputData": "[9,8,7,6,5,4,3,2,1,0]\n", "expectedOutput": "[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]\n", "marks": 5, "visibility": "hidden" }
  ]
}
```

**Auth:** Owner teacher of `assessmentId`. **Response (201):** full question + rubric + test cases.

---

### 3.2 `GET /api/questions/:id`

Return the full question payload (rubric + test cases).

**Auth:** Teacher (any) OR student answering an active submission. **Response (200).**

---

### 3.3 `PUT /api/questions/:id`

Update the question and its rubric or test cases (rubric/criteria and testCases are
replaced wholesale on update — pass the entire new arrays).

**Auth:** Owner teacher only. **Response (200).**

---

### 3.4 `DELETE /api/questions/:id`

Delete a question (cascade to rubric, test cases, any submissions referencing it
will simply have empty answers for that question id).

**Auth:** Owner teacher only. **Response (204).**

---

## 4. Submissions (`/api/submissions` + `/api/teacher/submissions`)

### 4.1 `POST /api/submissions`

Student creates (or updates) an assessment attempt. Call with `status = "in_progress"`
to initialize, then again with `"submitted"` to freeze.

**Auth:** Student only.

**Request body** (multipart/form-data when there are handwritten uploads; otherwise
`application/json` is fine).

```json
{
  "assessmentId": 1,
  "status": "submitted",
  "answers": [
    {
      "questionId": 1,
      "type": "subjective_text",
      "textAnswer": "A stack is a LIFO structure..."
    },
    {
      "questionId": 2,
      "type": "subjective_handwritten"
      /* handwritten file is passed as multipart field: handwritten_<questionId> */
    },
    {
      "questionId": 3,
      "type": "programming",
      "languageId": 71,
      "sourceCode": "def reverse_arr(arr):\n    return arr[::-1]\n"
    }
  ]
}
```

**Response (201 / 200):** `{ success: true, data: { submissionId, status, submittedAt } }`

**Common failures:**
- `409 CONFLICT` — submission already submitted.
- `400 BAD REQUEST` — missing answers, invalid programming language, handwritten file invalid.
- `413 PAYLOAD TOO LARGE` — handwritten file > `MAX_UPLOAD_MB`.

---

### 4.2 `GET /api/submissions/:id`

Fetch a single submission with all answers, evaluations, and test-case runs. Teachers
see the submission of any student of theirs; students only see their own.

**Auth:** Teacher (owner) or the owning student. **Response (200):** fully joined view.

---

### 4.3 `GET /api/teacher/submissions`

Paginated teacher-centric list of submissions across all assessments owned by the
calling teacher.

**Auth:** Teacher only.

**Query:** `?assessmentId=1`, `?status=evaluated`, `?studentId=5`, `?page=1&limit=20`.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "items": [ { "id": 7, "assessmentId": 1, "studentEmail": "..", "status": "evaluated", "totalMarks": 24.5, "maxMarks": 30, "percentage": 81.67, "submittedAt": "..."} ],
    "page": 1,
    "limit": 20,
    "totalCount": 42
  }
}
```

---

### 4.4 `GET /api/student/submissions`

Convenience alias for students to list their own submissions.

**Auth:** Student only. Same query/response shape as above, filtered to `student_id = me`.

---

## 5. Evaluations (`/api/submissions/:submissionId/evaluate`, `/api/evaluations/...`)

### 5.1 `POST /api/submissions/:submissionId/evaluate`

Kick off the AI evaluation pipeline for every subjective question in a submission.
For each subjective question:

1. If handwritten → call `POST /ai/ocr` (TrOCR or mock) to populate `ocr_extracted_text`.
2. Call `POST /ai/evaluate-answer` with student answer (text or OCR text) + reference
   answer + rubric → marks per criterion + feedback.
3. Write `evaluations`, `evaluation_criteria`, and `feedback` rows.
4. Move `submissions.status` → `evaluated`. Aggregate `total_marks` / `percentage`.

**Auth:** Teacher only. **Response (202):** `{ success: true, message: "Evaluation started" }`.

> If the AI service is unreachable the backend falls back to its own lightweight
> heuristic (`backend/src/services/evaluationService.fallbackEvaluate`) so the demo
> still flows end-to-end. The response clearly marks `evaluated_by_ai = false` and
> `ai_model_version = "nodejs-local-fallback/v1"` for such rows.

---

### 5.2 `GET /api/evaluations/:submissionId`

Return all evaluation records (one per subjective question) with criteria + feedback,
plus programming submission summaries. Powers the teacher "Submission Detail" screen.

**Auth:** Teacher (owner) or owning student (after `is_approved=true`; students see
only final marks + teacher feedback).

---

### 5.3 `PUT /api/evaluations/:id/review`

Teacher overrides marks, reasons, and feedback for a single evaluation. Does not
approve yet. Persists:
- `evaluation_criteria.awarded_marks_final = new value`
- `feedback.teacher_feedback = new value`
- `evaluation.teacher_total_marks = SUM(awarded_marks_final)`
- `reviewed_at = NOW()`

**Auth:** Teacher (owner). **Response (200).**

**Request body**

```json
{
  "teacherTotalMarks": 8,
  "criteria": [
    { "id": 101, "awardedMarksFinal": 2, "reason": "Great definition." },
    { "id": 102, "awardedMarksFinal": 1, "reason": "Example a bit thin." },
    { "id": 103, "awardedMarksFinal": 3, "reason": "All key concepts covered." },
    { "id": 104, "awardedMarksFinal": 2, "reason": "Good example." }
  ],
  "teacherFeedback": "Overall a strong answer. Make sure to mention LIFO explicitly next time."
}
```

---

### 5.4 `POST /api/evaluations/:id/approve`

Mark the evaluation as approved (`is_approved = true`, `approved_by = me`,
`approved_at = NOW()`). If **all** evaluations inside the parent submission are
approved, this endpoint also:

- Recalculates the submission's `total_marks`, `percentage`
- Upserts the `results` row (so the "Results" dashboard updates)
- Emits a Redis `PUBLISH` event (optional, documented in REDIS section of SETUP).

**Auth:** Teacher (owner). **Response (200).**

---

## 6. Programming (`/api/code`)

### 6.1 `POST /api/code/submit`

Takes a single programming answer (question id + language id + source code) and:

1. Validates inputs.
2. Pulls test cases for the question.
3. For each test case → calls Judge0 `POST /submissions` (base64 encodes `source_code`
   and `stdin`).
4. Loops `GET /submissions/:token` until Judge0 returns a terminal status.
5. Compares expected output vs actual output (after normalizing whitespace / line endings).
6. Writes `programming_submissions` row + per-case rows.
7. Returns the aggregate score.

**Auth:** Student only (in the real flow) OR teacher (for "test the test case" UIs).

**Request body**

```json
{
  "submissionId": 14,
  "questionId": 3,
  "languageId": 71,
  "sourceCode": "def reverse_arr(arr):\n    return arr[::-1]\n"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "programmingSubmissionId": 8,
    "overallStatus": "accepted",
    "awardedMarks": 20,
    "maxMarks": 20,
    "passedTestCases": 5,
    "totalTestCases": 5,
    "testCaseResults": [
      {
        "testCaseId": 12,
        "visibility": "public",
        "status": "accepted",
        "awardedMarks": 5,
        "maxMarks": 5,
        "actualOutput": "[3, 2, 1]\n",
        "expectedOutput": "[3, 2, 1]\n",
        "stderr": null,
        "timeSeconds": 0.042,
        "memoryKb": 9800
      }
      /* …5 rows total, hidden cases only show status/marks not outputs to students */
    ]
  }
}
```

**Common failures:** `502 BAD_GATEWAY` (Judge0 unreachable → retried 3× with backoff;
on final failure the submission is persisted with `overall_status = internal_error`,
`error_message = "Judge0 unreachable: …"`, `awarded_marks = 0`).

---

### 6.2 `GET /api/code/submissions/:id`

Return the full programming submission + per-case run details.

**Auth:** Owning student OR teacher (owner of the assessment). Students do **not** see
expected/actual outputs for `visibility = hidden` cases (we null them out in the
response layer).

---

## 7. Results (`/api/results`)

### 7.1 `GET /api/teacher/results`

Class-level summary: per assessment, per student, their total mark, percentage, grade,
rank. **Auth:** Teacher only.

**Query:** `?assessmentId=1`, `?studentId=5` (optional).

### 7.2 `GET /api/student/results`

Per-student results list. Same shape, filtered to `student_id = me`.

---

## 8. Miscellaneous

### 8.1 `GET /api/health`

Lightweight liveness probe. Tries a Postgres ping + Redis ping and reports status.
Failing DB/Redis still returns HTTP 200 for the `server` field (so Docker healthchecks
still succeed while the services are warming up), but reports `postgres: "down"` etc.

**Response (200)**

```json
{
  "success": true,
  "data": {
    "server":   "ok",
    "postgres": "ok",
    "redis":    "ok",
    "aiService": "reachable" | "unreachable" | "unconfigured" | "mock-mode",
    "judge0":   "reachable" | "unreachable" | "unconfigured",
    "time":     "2025-03-18T12:34:56.789Z"
  }
}
```

### 8.2 File download — `GET /api/files/answers/:filename`

Returns the handwritten upload stored under `UPLOADS_ROOT` (PNG/JPG/PDF) with the
correct `Content-Type`. Authorization: the caller must be the student who submitted
it or the owning teacher.

---

## 9. Auth roles summary table

| Endpoint prefix                         | Method    | Role              |
| --------------------------------------- | --------- | ----------------- |
| `/api/auth/*`                           | POST      | public            |
| `/api/assessments`                      | GET       | teacher + student |
| `/api/assessments`                      | POST      | teacher           |
| `/api/assessments/:id`                  | GET       | teacher + student |
| `/api/assessments/:id`                  | PUT/DELETE| teacher           |
| `/api/assessments/:id/publish`          | POST      | teacher           |
| `/api/questions/*`                      | ALL       | teacher           |
| `/api/submissions`                      | POST      | student           |
| `/api/submissions/:id`                  | GET       | teacher + student |
| `/api/teacher/submissions`              | GET       | teacher           |
| `/api/student/submissions`              | GET       | student           |
| `/api/submissions/:id/evaluate`         | POST      | teacher           |
| `/api/evaluations/:id`                  | GET       | teacher + student |
| `/api/evaluations/:id/review`           | PUT       | teacher           |
| `/api/evaluations/:id/approve`          | POST      | teacher           |
| `/api/code/submit`                      | POST      | student / teacher |
| `/api/code/submissions/:id`             | GET       | teacher + student |
| `/api/teacher/results`                  | GET       | teacher           |
| `/api/student/results`                  | GET       | student           |
| `/api/health`                           | GET       | public            |

---

## 10. Status codes

| HTTP | Usage                                                              |
| ---- | ------------------------------------------------------------------ |
| 200  | OK (GET/PUT succeeded)                                             |
| 201  | Resource created                                                   |
| 202  | Background job accepted (evaluation started, polling expected)    |
| 204  | Delete successful, no body                                         |
| 400  | Validation / bad request                                           |
| 401  | Missing/invalid JWT                                                |
| 403  | Valid JWT but wrong role / not owner                               |
| 404  | Resource not found                                                 |
| 409  | Conflict (duplicate email, already submitted, etc.)                |
| 413  | File too large                                                     |
| 415  | Wrong MIME type on upload                                          |
| 500  | Unexpected server error (stack trace logged, hidden from client)   |
| 502  | Judge0 / AI-service unreachable after retries                      |
| 503  | Database unavailable for a write                                   |
