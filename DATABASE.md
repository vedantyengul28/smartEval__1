# SmartEval — Database Design (PostgreSQL)

SmartEval stores all state in a single PostgreSQL database. This document describes
the **enums**, **tables**, **triggers**, **seeding**, and **query conventions** used.

> The single source of truth for DDL is `database/schema.sql`. Apply it to an empty
> database before starting the backend (see `SETUP.md`). Seed data lives in
> `database/seed.sql`.

---

## 1. Conventions

- All identifiers are **snake_case**.
- Primary keys are always **`id BIGSERIAL PRIMARY KEY`**.
- Foreign keys follow the pattern `{referenced_table}_id BIGINT REFERENCES {table}(id)`.
- Every "business" table carries `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` and
  `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- An `updated_at` trigger keeps `updated_at` in sync on every `UPDATE`.
- Enum-typed columns use PostgreSQL native `ENUM`s listed in §2.

---

## 2. Enums

| Enum name             | Values                                                                      | Purpose                                         |
| --------------------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| `user_role`           | `teacher`, `student`                                                        | Role-based access control                       |
| `account_status`      | `active`, `inactive`, `banned`                                              | User lifecycle                                  |
| `question_type`       | `subjective_text`, `subjective_handwritten`, `programming`                 | What kind of answer a question expects          |
| `programming_language`| `python`, `java`, `cpp`                                                     | Judge0 language family                          |
| `assessment_status`   | `draft`, `published`, `archived`, `closed`                                  | Assessment lifecycle                            |
| `submission_status`   | `in_progress`, `submitted`, `evaluating`, `evaluated`, `reviewed`, `error`  | Lifecycle of a single submission                |
| `judge0_status`       | `pending`, `queued`, `processing`, `accepted`, `wrong_answer`, `runtime_error`, `compilation_error`, `timelimit`, `memorylimit`, `internal_error`, `unknown` | Mirrors Judge0 status IDs |
| `visibility`          | `public`, `private`, `hidden`                                               | Reserved for future visibility controls         |

---

## 3. Tables

### 3.1 `users`

All registered accounts, both teachers and students.

| Column         | Type                  | Nullable | Default        | Notes                                                  |
| -------------- | --------------------- | -------- | -------------- | ------------------------------------------------------ |
| `id`           | `BIGSERIAL`           | ❌       | —              | PK                                                     |
| `email`        | `VARCHAR(255)`        | ❌       | —              | `UNIQUE`, used as login name                           |
| `password_hash`| `VARCHAR(255)`        | ❌       | —              | bcrypt (round 10) **hash only, never plaintext**       |
| `first_name`   | `VARCHAR(120)`        | ❌       | —              | Displayed in dashboards                                |
| `last_name`    | `VARCHAR(120)`        | ❌       | —              | Displayed in dashboards                                |
| `role`         | `user_role`           | ❌       | `'student'`    | RBAC                                                   |
| `status`       | `account_status`      | ❌       | `'active'`     | Lifecycle flag                                         |
| `created_at`   | `TIMESTAMPTZ`         | ❌       | `NOW()`        |                                                        |
| `updated_at`   | `TIMESTAMPTZ`         | ❌       | `NOW()`        | Trigger-maintained                                     |

**Indexes:** `UNIQUE INDEX users_email_key (email)`, partial indexes on `(role, status)`.

---

### 3.2 `assessments`

An assessment (exam / quiz) is created by a teacher and attempted by students.

| Column              | Type                 | Nullable | Default     | Notes                                              |
| ------------------- | -------------------- | -------- | ----------- | -------------------------------------------------- |
| `id`                | `BIGSERIAL`          | ❌       | —           | PK                                                 |
| `teacher_id`        | `BIGINT`             | ❌       | —           | FK → `users(id)`. Must be `role=teacher`.          |
| `title`             | `VARCHAR(255)`       | ❌       | —           | E.g. "CS101 Midterm Exam"                          |
| `description`       | `TEXT`               | ✅       | `NULL`      | Short description shown to students                |
| `course_code`       | `VARCHAR(40)`        | ✅       | `NULL`      | E.g. "CS101"                                       |
| `total_marks`       | `INTEGER`            | ❌       | `0`         | Derived: SUM of questions.max_marks                |
| `duration_minutes`  | `INTEGER`            | ✅       | `NULL`      | Optional enforced time window                      |
| `status`            | `assessment_status`  | ❌       | `'draft'`   | Workflow: draft → published → (archived/closed)    |
| `start_time`        | `TIMESTAMPTZ`        | ✅       | `NULL`      | Optional "open from" time                           |
| `end_time`          | `TIMESTAMPTZ`        | ✅       | `NULL`      | Optional "closes at" time                           |
| `created_at`        | `TIMESTAMPTZ`        | ❌       | `NOW()`     |                                                    |
| `updated_at`        | `TIMESTAMPTZ`        | ❌       | `NOW()`     | Trigger-maintained                                 |

**Indexes:** `idx_assessments_teacher (teacher_id)`, `idx_assessments_status (status)`.

---

### 3.3 `questions`

A single question inside an assessment. Question type determines which related tables
are used.

| Column                 | Type                     | Nullable | Default       | Notes                                                                |
| ---------------------- | ------------------------ | -------- | ------------- | -------------------------------------------------------------------- |
| `id`                   | `BIGSERIAL`              | ❌       | —             | PK                                                                   |
| `assessment_id`        | `BIGINT`                 | ❌       | —             | FK → `assessments(id)`, `ON DELETE CASCADE`                          |
| `position`             | `INTEGER`                | ❌       | `0`           | Display order within assessment                                      |
| `type`                 | `question_type`          | ❌       | —             | Determines which child tables are populated                          |
| `text`                 | `TEXT`                   | ❌       | —             | The question stem                                                    |
| `max_marks`            | `INTEGER`                | ❌       | —             | Maximum obtainable marks for this question                           |
| `reference_answer`     | `TEXT`                   | ✅*      | `NULL`        | Required for subjective types; rubric evaluates against it           |
| `programming_language` | `programming_language`   | ✅       | `NULL`        | Set only when `type = 'programming'`                                 |
| `boilerplate_code`     | `TEXT`                   | ✅       | `NULL`        | Starter code shown to students in Monaco editor                      |
| `time_limit_seconds`   | `INTEGER`                | ✅       | `NULL`        | Judge0 per-run CPU/time limit override                               |
| `created_at`           | `TIMESTAMPTZ`            | ❌       | `NOW()`       |                                                                      |
| `updated_at`           | `TIMESTAMPTZ`            | ❌       | `NOW()`       | Trigger-maintained                                                   |

**Constraints:**
- `CHECK (max_marks > 0)`
- `CHECK ((type IN ('subjective_text','subjective_handwritten') AND reference_answer IS NOT NULL) OR (type = 'programming'))`

---

### 3.4 `rubrics` + `rubric_criteria`

Each subjective question may have one rubric composed of multiple criteria.

**`rubrics`**

| Column           | Type        | Nullable | Default     | Notes                                          |
| ---------------- | ----------- | -------- | ----------- | ---------------------------------------------- |
| `id`             | `BIGSERIAL` | ❌       | —           | PK                                             |
| `question_id`    | `BIGINT`    | ❌       | —           | FK → `questions(id)`, `UNIQUE` (1:1).          |
| `instructions`   | `TEXT`      | ✅       | `NULL`      | Free-form grader instructions (AI + humans).   |
| `created_at`     | `TIMESTAMPTZ`| ❌      | `NOW()`     |                                                |
| `updated_at`     | `TIMESTAMPTZ`| ❌      | `NOW()`     | Trigger-maintained                             |

**`rubric_criteria`**

| Column          | Type        | Nullable | Default     | Notes                                                       |
| --------------- | ----------- | -------- | ----------- | ----------------------------------------------------------- |
| `id`            | `BIGSERIAL` | ❌       | —           | PK                                                          |
| `rubric_id`     | `BIGINT`    | ❌       | —           | FK → `rubrics(id)` `ON DELETE CASCADE`                      |
| `name`          | `VARCHAR(160)`| ❌      | —           | E.g. "Definition", "Key concepts"                           |
| `description`   | `TEXT`      | ✅       | `NULL`      | What the grader should look for                             |
| `maximum_marks` | `INTEGER`   | ❌       | —           | `CHECK (maximum_marks >= 0)`. Sum = rubric/question max.    |
| `position`      | `INTEGER`   | ❌       | `0`         | Display order                                               |
| `keywords`      | `TEXT[]`    | ✅       | `'{}'`      | Optional weighted keywords used by the Evaluation Engine    |
| `created_at`    | `TIMESTAMPTZ`| ❌      | `NOW()`     |                                                             |
| `updated_at`    | `TIMESTAMPTZ`| ❌      | `NOW()`     | Trigger-maintained                                          |

---

### 3.5 `test_cases`

Programming questions can have multiple test cases.

| Column              | Type        | Nullable | Default     | Notes                                                                |
| ------------------- | ----------- | -------- | ----------- | -------------------------------------------------------------------- |
| `id`                | `BIGSERIAL` | ❌       | —           | PK                                                                   |
| `question_id`       | `BIGINT`    | ❌       | —           | FK → `questions(id)`. Only populated for programming questions.      |
| `position`          | `INTEGER`   | ❌       | `0`         | Run order                                                            |
| `input_data`        | `TEXT`      | ✅       | `''`        | Stdin for the submission                                              |
| `expected_output`   | `TEXT`      | ❌       | —           | Expected stdout (compared after whitespace normalization)            |
| `marks`             | `INTEGER`   | ❌       | —           | Marks awarded on passing. Sum = question max_marks.                  |
| `visibility`        | `visibility`| ❌       | `'public'`  | `hidden` test cases are never shown to students                      |
| `time_limit_seconds`| `INTEGER`   | ✅       | `NULL`      | Override for a single case                                           |
| `created_at`        | `TIMESTAMPTZ`| ❌      | `NOW()`     |                                                                      |
| `updated_at`        | `TIMESTAMPTZ`| ❌      | `NOW()`     | Trigger-maintained                                                   |

---

### 3.6 `submissions`

One student attempt of one assessment. Individual answers live in child tables.

| Column            | Type                | Nullable | Default        | Notes                                                     |
| ----------------- | ------------------- | -------- | -------------- | --------------------------------------------------------- |
| `id`              | `BIGSERIAL`         | ❌       | —              | PK                                                        |
| `assessment_id`   | `BIGINT`            | ❌       | —              | FK → `assessments(id)`                                    |
| `student_id`      | `BIGINT`            | ❌       | —              | FK → `users(id)`. Must be `role=student`.                 |
| `status`          | `submission_status` | ❌       | `'in_progress'`| Workflow: in_progress → submitted → evaluating → evaluated/reviewed |
| `total_marks`     | `NUMERIC(10,2)`     | ✅       | `0`            | Aggregated after evaluation                               |
| `max_marks`       | `INTEGER`           | ✅       | `0`            | Assessment total_marks snapshot                           |
| `percentage`      | `NUMERIC(5,2)`      | ✅       | `NULL`         | (total_marks / max_marks) * 100                           |
| `started_at`      | `TIMESTAMPTZ`       | ❌       | `NOW()`        | When student first opened the attempt                     |
| `submitted_at`    | `TIMESTAMPTZ`       | ✅       | `NULL`         | Set when status moves past `in_progress`                  |
| `evaluated_at`    | `TIMESTAMPTZ`       | ✅       | `NULL`         | Set when all evaluations exist                           |
| `created_at`      | `TIMESTAMPTZ`       | ❌       | `NOW()`        |                                                           |
| `updated_at`      | `TIMESTAMPTZ`       | ❌       | `NOW()`        | Trigger-maintained                                        |

**Constraint:** `UNIQUE (assessment_id, student_id)` — one submission per student per assessment.

**Indexes:** `idx_submissions_student (student_id)`, `idx_submissions_assessment (assessment_id)`, `idx_submissions_status (status)`.

---

### 3.7 `subjective_answers`

Holds textual or handwritten answers for a subjective question.

| Column                | Type        | Nullable | Default     | Notes                                                                  |
| --------------------- | ----------- | -------- | ----------- | ---------------------------------------------------------------------- |
| `id`                  | `BIGSERIAL` | ❌       | —           | PK                                                                     |
| `submission_id`       | `BIGINT`    | ❌       | —           | FK → `submissions(id)` `ON DELETE CASCADE`                             |
| `question_id`         | `BIGINT`    | ❌       | —           | FK → `questions(id)`                                                   |
| `text_answer`         | `TEXT`      | ✅       | `NULL`      | Student-typed answer (for `subjective_text`)                           |
| `handwritten_file_path` | `VARCHAR(500)` | ✅  | `NULL`      | Relative path inside `UPLOADS_ROOT` (for `subjective_handwritten`)     |
| `handwritten_file_name` | `VARCHAR(255)` | ✅  | `NULL`      | Original name shown back to the user                                   |
| `handwritten_mime_type` | `VARCHAR(100)` | ✅  | `NULL`      | MIME type used for rendering                                           |
| `ocr_extracted_text`  | `TEXT`      | ✅       | `NULL`      | Text produced by TrOCR (or mock) pipeline, used for evaluation        |
| `ocr_status`          | `VARCHAR(40)` | ✅     | `NULL`      | E.g. `"processed"`, `"failed: <msg>"`                                 |
| `created_at`          | `TIMESTAMPTZ`| ❌      | `NOW()`     |                                                                        |
| `updated_at`          | `TIMESTAMPTZ`| ❌      | `NOW()`     | Trigger-maintained                                                     |

**Constraint:** Exactly one of `text_answer` or `handwritten_file_path` must be `NOT NULL`.

---

### 3.8 `programming_submissions`

Holds one student code submission for one programming question plus per-test-case
results returned by Judge0.

| Column                 | Type             | Nullable | Default     | Notes                                                               |
| ---------------------- | ---------------- | -------- | ----------- | ------------------------------------------------------------------- |
| `id`                   | `BIGSERIAL`      | ❌       | —           | PK                                                                  |
| `submission_id`        | `BIGINT`         | ❌       | —           | FK → `submissions(id)` `ON DELETE CASCADE`                          |
| `question_id`          | `BIGINT`         | ❌       | —           | FK → `questions(id)`                                                |
| `language_id`          | `INTEGER`        | ❌       | —           | Judge0 language_id (71=Python, 62=Java, 54=C++)                     |
| `source_code`          | `TEXT`           | ❌       | —           | Raw source as submitted in Monaco                                   |
| `total_marks_awarded`  | `NUMERIC(10,2)`  | ❌       | `0`         | Sum of marks for passing test cases                                 |
| `total_marks_max`      | `INTEGER`        | ❌       | `0`         | Denominator snapshot of question max_marks                          |
| `passed_test_cases`    | `INTEGER`        | ❌       | `0`         | Counters shown in UI                                                |
| `total_test_cases`     | `INTEGER`        | ❌       | `0`         |                                                                     |
| `overall_status`       | `judge0_status`  | ✅       | `NULL`      | Aggregate status                                                    |
| `judge0_token`         | `VARCHAR(255)`   | ✅       | `NULL`      | Reserved; we submit per-case instead of batch                       |
| `compiler_stdout`      | `TEXT`           | ✅       | `NULL`      | Any compile diagnostic captured                                     |
| `compiler_stderr`      | `TEXT`           | ✅       | `NULL`      |                                                                     |
| `error_message`        | `TEXT`           | ✅       | `NULL`      | Fatal non-Judge0 error (network, etc.)                              |
| `evaluated_at`         | `TIMESTAMPTZ`    | ✅       | `NULL`      | When the run finished                                              |
| `created_at`           | `TIMESTAMPTZ`    | ❌       | `NOW()`     |                                                                     |
| `updated_at`           | `TIMESTAMPTZ`    | ❌       | `NOW()`     | Trigger-maintained                                                  |

**Child table: `programming_test_case_results`**

| Column                    | Type            | Nullable | Default     | Notes                                                  |
| ------------------------- | --------------- | -------- | ----------- | ------------------------------------------------------ |
| `id`                      | `BIGSERIAL`     | ❌       | —           | PK                                                     |
| `programming_submission_id` | `BIGINT`      | ❌       | —           | FK → `programming_submissions(id)` `ON DELETE CASCADE` |
| `test_case_id`            | `BIGINT`        | ❌       | —           | FK → `test_cases(id)`                                  |
| `status`                  | `judge0_status` | ✅       | `NULL`      | Per-case status                                        |
| `awarded_marks`           | `NUMERIC(10,2)` | ❌       | `0`         | 0 or test_cases.marks                                  |
| `max_marks`               | `INTEGER`       | ❌       | `0`         | Denominator snapshot                                   |
| `actual_output`           | `TEXT`          | ✅       | `NULL`      | Judge0 `stdout`                                        |
| `expected_output_snapshot`| `TEXT`          | ✅       | `NULL`      | Snapshotted at run time for UI comparison              |
| `stderr`                  | `TEXT`          | ✅       | `NULL`      | Judge0 `stderr`                                        |
| `compile_output`          | `TEXT`          | ✅       | `NULL`      | Judge0 `compile_output`                                |
| `time_seconds`            | `NUMERIC(10,4)` | ✅       | `NULL`      |                                                        |
| `memory_kb`               | `INTEGER`       | ✅       | `NULL`      |                                                        |
| `judge0_token`            | `VARCHAR(255)`  | ✅       | `NULL`      | Token returned by Judge0 for this single submission    |
| `created_at`              | `TIMESTAMPTZ`   | ❌       | `NOW()`     |                                                        |
| `updated_at`              | `TIMESTAMPTZ`   | ❌       | `NOW()`     | Trigger-maintained                                     |

**Constraint:** `UNIQUE (programming_submission_id, test_case_id)`.

---

### 3.9 `evaluations` + `evaluation_criteria` + `feedback`

After a subjective answer is evaluated (AI → teacher review → approve), we store:

**`evaluations`**

| Column               | Type            | Nullable | Default        | Notes                                                               |
| -------------------- | --------------- | -------- | -------------- | ------------------------------------------------------------------- |
| `id`                 | `BIGSERIAL`     | ❌       | —              | PK                                                                  |
| `submission_id`      | `BIGINT`        | ❌       | —              | FK → `submissions(id)`                                              |
| `question_id`        | `BIGINT`        | ❌       | —              | FK → `questions(id)`                                                |
| `evaluated_by_ai`    | `BOOLEAN`       | ❌       | `TRUE`         | Whether AI produced the initial version                            |
| `ai_model_version`   | `VARCHAR(200)`  | ✅       | `NULL`         | E.g. `"mock/v1"`, `"paraphrase-MiniLM-L6-v2+trocr-base"`            |
| `overall_similarity` | `NUMERIC(5,4)`  | ✅       | `NULL`         | SBERT (or fallback) cosine similarity between ref & student answer  |
| `ai_total_marks`     | `NUMERIC(10,2)` | ✅       | `NULL`         | AI-proposed total (preserved even if teacher overrides)             |
| `teacher_total_marks`| `NUMERIC(10,2)` | ✅       | `NULL`         | Teacher-adjusted total (shown after approval)                       |
| `max_marks`          | `INTEGER`       | ❌       | —              | Question max_marks snapshot                                         |
| `is_approved`        | `BOOLEAN`       | ❌       | `FALSE`        | Flipped by `POST /api/evaluations/:id/approve`                      |
| `approved_by`        | `BIGINT`        | ✅       | `NULL`         | FK → `users(id)` (teacher)                                          |
| `approved_at`        | `TIMESTAMPTZ`   | ✅       | `NULL`         |                                                                     |
| `evaluated_at`       | `TIMESTAMPTZ`   | ✅       | `NULL`         | When AI evaluation finished                                         |
| `reviewed_at`        | `TIMESTAMPTZ`   | ✅       | `NULL`         | When teacher last updated via `PUT /api/evaluations/:id/review`     |
| `created_at`         | `TIMESTAMPTZ`   | ❌       | `NOW()`        |                                                                     |
| `updated_at`         | `TIMESTAMPTZ`   | ❌       | `NOW()`        | Trigger-maintained                                                  |

**`evaluation_criteria`**

Per-rubric-criterion scores and human-readable reasons.

| Column             | Type            | Nullable | Default     | Notes                                                              |
| ------------------ | --------------- | -------- | ----------- | ------------------------------------------------------------------ |
| `id`               | `BIGSERIAL`     | ❌       | —           | PK                                                                 |
| `evaluation_id`    | `BIGINT`        | ❌       | —           | FK → `evaluations(id)` `ON DELETE CASCADE`                         |
| `rubric_criterion_id` | `BIGINT`     | ✅       | `NULL`      | FK → `rubric_criteria(id)`. Stable link back to rubric.            |
| `criterion_name`   | `VARCHAR(160)`  | ❌       | —           | Snapshotted name in case rubric is edited later                    |
| `max_marks`        | `INTEGER`       | ❌       | —           | Denominator snapshot                                               |
| `awarded_marks_ai` | `NUMERIC(10,2)` | ✅       | `NULL`      | AI's original proposal                                             |
| `awarded_marks_final` | `NUMERIC(10,2)` | ❌    | —           | Either AI marks (no review) or teacher-adjusted value              |
| `reason`           | `TEXT`          | ✅       | `NULL`      | Human-readable explanation written by AI / edited by teacher       |
| `created_at`       | `TIMESTAMPTZ`   | ❌       | `NOW()`     |                                                                    |
| `updated_at`       | `TIMESTAMPTZ`   | ❌       | `NOW()`     | Trigger-maintained                                                 |

**`feedback`**

Per-question, teacher-facing and student-facing text feedback.

| Column             | Type        | Nullable | Default        | Notes                                                         |
| ------------------ | ----------- | -------- | -------------- | ------------------------------------------------------------- |
| `id`               | `BIGSERIAL` | ❌       | —              | PK                                                            |
| `evaluation_id`    | `BIGINT`    | ❌       | —              | FK → `evaluations(id)` `ON DELETE CASCADE`                    |
| `ai_feedback`      | `TEXT`      | ✅       | `NULL`         | Feedback text proposed by the AI engine                       |
| `teacher_feedback` | `TEXT`      | ✅       | `NULL`         | Teacher-edited version (shown to students after approve)      |
| `created_at`       | `TIMESTAMPTZ`| ❌      | `NOW()`        |                                                               |
| `updated_at`       | `TIMESTAMPTZ`| ❌      | `NOW()`        | Trigger-maintained                                            |

---

### 3.10 `results`

Aggregated student result row — written once the teacher approves every question in a
submission. This table powers the "results" dashboard pages.

| Column             | Type             | Nullable | Default    | Notes                                                    |
| ------------------ | ---------------- | -------- | ---------- | -------------------------------------------------------- |
| `id`               | `BIGSERIAL`      | ❌       | —          | PK                                                       |
| `submission_id`    | `BIGINT`         | ❌       | —          | FK → `submissions(id)`. `UNIQUE`.                        |
| `student_id`       | `BIGINT`         | ❌       | —          | FK → `users(id)`                                         |
| `assessment_id`    | `BIGINT`         | ❌       | —          | FK → `assessments(id)`                                   |
| `total_marks`      | `NUMERIC(10,2)`  | ❌       | `0`        | Sum of per-question final marks                          |
| `max_marks`        | `INTEGER`        | ❌       | `0`        | Assessment total snapshot                                |
| `percentage`       | `NUMERIC(5,2)`   | ✅       | `NULL`     | (total_marks / max_marks) * 100                          |
| `grade`            | `VARCHAR(10)`    | ✅       | `NULL`     | Optional letter grade (calculated in service layer)      |
| `rank`             | `INTEGER`        | ✅       | `NULL`     | Rank among students who attempted this assessment        |
| `published_at`     | `TIMESTAMPTZ`    | ✅       | `NULL`     |                                                          |
| `created_at`       | `TIMESTAMPTZ`    | ❌       | `NOW()`    |                                                          |
| `updated_at`       | `TIMESTAMPTZ`    | ❌       | `NOW()`    | Trigger-maintained                                       |

---

## 4. Trigger: `updated_at`

`schema.sql` creates a universal helper:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

A trigger is attached to every table that has an `updated_at` column using a loop.
You never need to include `updated_at` in `INSERT`/`UPDATE` statements.

---

## 5. Relationships (ERD summary)

```
users (teacher) ─────┐
                     ├─ assessments ── questions ────┬─── rubrics ───── rubric_criteria
users (student) ─┐   │                               └─── test_cases (programming only)
                 │   │
                 │   └── submissions ───────────┬─── subjective_answers
                 │                              ├─── programming_submissions ── test_case_results
                 │                              └─── evaluations ──┬── evaluation_criteria
                 │                                                 └── feedback
                 └──── results (back-links to submission/student/assessment)
```

---

## 6. Backend query conventions

The Node backend never builds raw SQL strings with concatenated user input. All queries
use `pg` parameterized queries via `query()` / `transaction()` exposed from
`backend/src/config/database.js`.

Writes that need atomicity (e.g. evaluation insert + criteria rows + feedback row
+ submission totals update + result insert) are wrapped in a `transaction()` callback
and commit/rollback is handled for you.

---

## 7. Seeding (`database/seed.sql`)

`seed.sql` is idempotent for the demo rows it creates (it deletes them in reverse FK
order first). Running it once after `schema.sql` provides:

- 1 teacher account — `teacher@example.com` / `password123`
- 2 student accounts — `student@example.com` / `student2@example.com`, both password `password123`
- 1 draft-cum-published assessment "CS101 Midterm Exam — Data Structures" (total 30 marks)
- 1 subjective question on "Stacks vs Queues" (10 marks, 4 rubric criteria)
- 1 programming question "Reverse an array" in Python (20 marks, 5 test cases — one hidden)

The bcrypt hashes embedded in `seed.sql` are **valid round-10 hashes of `password123`**
generated with `bcryptjs` before packaging. If you ever rotate `password123`, run:

```bash
cd backend
node -e "const b=require('bcryptjs'); console.log(b.hashSync('NEW_PASSWORD',10));"
```

And replace the three `password_hash` values in `seed.sql`.
