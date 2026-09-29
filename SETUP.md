# SmartEval — Setup & Run

Two supported ways to run SmartEval:

- **A) Native run** (fastest iteration, uses your local Postgres/Redis or Docker just
  for those two services).
- **B) Full docker-compose** (one command, containers for everything, what the
  evaluator will likely want to see).

Pick **A** for daily development, **B** for packaging / demo.

> Default development URL:
> - Frontend (React): `http://localhost:5173`
> - Backend API (Express): `http://localhost:4000`
> - AI service (FastAPI): `http://localhost:5050`
> - Postgres: `localhost:5432`, db `smarteval`
> - Redis: `localhost:6379`

---

## 0. Prerequisites

### Native run (Option A)

| Tool   | Minimum version | Check with                  |
| ------ | --------------- | --------------------------- |
| Node   | 18 LTS          | `node -v`                   |
| npm    | 9               | `npm -v`                    |
| Python | 3.10            | `python --version`          |
| Postgres | 14+           | `psql --version`            |
| Redis  | 6+              | `redis-cli --version`       |
| (Optional) GPU w/ ≥ 4 GB VRAM | — | Used only if `AI_USE_MOCK_MODE=false` |

### Docker run (Option B)

| Tool           | Version  |
| -------------- | -------- |
| Docker Engine  | ≥ 24     |
| Docker Compose | ≥ 2.20   |

Run `docker version` and `docker compose version` to confirm.

---

## 1. Environment variables

Copy the root `.env.example` to `.env` once. All services read values from here (for
native runs) or Docker Compose injects them (Option B).

```bash
# PowerShell (Windows)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Key variables — the only ones you usually need to edit:

| Variable                    | Default                                   | Purpose                                                           |
| --------------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| `BACKEND_PORT`              | `4000`                                    | Express listen port                                               |
| `FRONTEND_PORT`             | `5173`                                    | Vite dev / Nginx container port                                   |
| `AI_PORT`                   | `5050`                                    | FastAPI listen port                                               |
| `JWT_SECRET`                | `change-me-in-prod`                       | **Change this** — used to sign JWTs.                               |
| `JWT_EXPIRES_IN`            | `7d`                                      | Token lifetime.                                                   |
| `DATABASE_URL`              | `postgresql://smarteval:smarteval@localhost:5432/smarteval` | Postgres connection string. Change host to `postgres` in Docker.  |
| `REDIS_URL`                 | `redis://localhost:6379/0`                | Redis URL. Host = `redis` in Docker.                              |
| `AI_BASE_URL`               | `http://localhost:5050`                   | Where Node reaches the Python AI service.                         |
| `AI_USE_MOCK_MODE`          | `true`                                    | `true` = no HF download, deterministic mock OCR + SBERT fallback. |
| `JUDGE0_USE_PUBLIC_CE`      | `true`                                    | Use `https://ce.judge0.com` — no local Judge0 setup.              |
| `JUDGE0_API_URL`            | `https://ce.judge0.com`                   | Override when `JUDGE0_USE_PUBLIC_CE=false` (e.g. self-hosted).    |
| `MAX_UPLOAD_MB`             | `10`                                      | Handwritten file upload cap.                                      |
| `UPLOADS_ROOT`              | `../uploads` (relative to `backend/`)     | Where Multer stores handwritten files. NEVER commit this dir.     |
| `CORS_ORIGINS`              | `http://localhost:5173`                   | Comma-separated, used in Express `cors()`.                        |

> **Judge0 note:** `ce.judge0.com` is public/unauthenticated. If you use it, be kind
> with rate. For a real production deployment, self-host Judge0 via Docker Compose
> (Judge0 docs → "Self-Hosted").

---

## 2. Option A — Native run (development)

### 2.1 Postgres + Redis

Start them however you normally start local services. If you don't have them installed,
you can spin up *just* those two in Docker (cheat code):

```bash
docker compose up -d postgres redis
```

### 2.2 Create the database & apply schema

```bash
# Using psql (or pgAdmin) connected to the Postgres server:
CREATE DATABASE smarteval;
CREATE USER smarteval WITH PASSWORD 'smarteval';
GRANT ALL PRIVILEGES ON DATABASE smarteval TO smarteval;
\c smarteval
-- Then run:
\ir database/schema.sql
\ir database/seed.sql
```

Or non-interactively:

```bash
set -a; . ./.env; set +a
psql $DATABASE_URL -f database/schema.sql
psql $DATABASE_URL -f database/seed.sql
```

### 2.3 Backend (Node/Express)

```bash
cd backend
npm install
# Dev mode with auto-reload (nodemon):
npm run dev
# Or prod:
npm start
```

Verify:

```bash
curl http://localhost:4000/api/health
```

You should see `server: "ok"` and real status for postgres/redis/ai/judge0.

### 2.4 AI service (Python/FastAPI)

```bash
cd ai-service
python -m venv .venv

# Windows (PowerShell 5/7):
.venv\Scripts\Activate.ps1

# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt

# Dev mode (auto-reload):
uvicorn app.main:app --reload --host 0.0.0.0 --port 5050

# Or prod:
uvicorn app.main:app --host 0.0.0.0 --port 5050 --workers 2
```

Verify:

```bash
curl http://localhost:5050/ai/health
```

You should see `mock_mode: true` (default) and `sbert.ready`, `trocr.ready` both
`true` — that means the deterministic mock/SVD fallbacks are active and serving.

### 2.5 Frontend (Vite + React)

```bash
cd frontend
# Copy frontend env (Vite needs VITE_* prefix vars)
Copy-Item .env.example .env    # PowerShell
# cp .env.example .env         # macOS/Linux

npm install
npm run dev
```

Open `http://localhost:5173`. The Login screen should appear.

### 2.6 Default demo credentials (seeded by `seed.sql`)

| Role     | Email                     | Password      |
| -------- | ------------------------- | ------------- |
| Teacher  | `teacher@example.com`     | `password123` |
| Student  | `student@example.com`     | `password123` |
| Student  | `student2@example.com`    | `password123` |

> bcrypt hashes in `seed.sql` were generated with `bcryptjs`, round 10. If you want to
> confirm or regenerate them, run:
>
> ```bash
> cd backend
> node -e "const b=require('bcryptjs'); console.log(b.hashSync('password123',10));"
> ```

---

## 3. Option B — Full docker-compose run

One command brings up everything:

```bash
docker compose up -d --build
```

Compose will:

1. Build `frontend/Dockerfile` → static assets served by Nginx on port `5173`.
2. Build `backend/Dockerfile` → Node on port `4000`.
3. Build `ai-service/Dockerfile` → uvicorn on port `5050`.
4. Start `postgres:16-alpine` on port `5432` with volume `smarteval-pgdata`.
5. Start `redis:7-alpine` on port `6379` with volume `smarteval-redisdata`.
6. Apply `database/schema.sql` and `database/seed.sql` automatically via
   `postgres` service's `/docker-entrypoint-initdb.d/` mount (runs only on first
   start with a fresh volume).
7. Wait for postgres + redis healthchecks before starting backend/ai.

### 3.1 Tailing logs

```bash
# All services
docker compose logs -f

# One service
docker compose logs -f backend
docker compose logs -f ai-service
docker compose logs -f frontend
```

### 3.2 Verify each service

```bash
# Frontend
curl -I http://localhost:5173                  # 200 OK

# Backend health
curl http://localhost:4000/api/health          # server: ok, postgres: ok, redis: ok, ai: reachable|mock-mode, judge0: reachable

# AI health
curl http://localhost:5050/ai/health           # status: ok, mock_mode: true
```

### 3.3 Stop / reset

```bash
# Stop, keep volumes:
docker compose down

# Stop and DELETE volumes (including Postgres data!):
docker compose down -v
```

---

## 4. First-run walkthrough (verify the 28-spec demo flow)

With everything up, step through the demo scenario from §28 of the spec:

1. **Teacher login.** Browser → `http://localhost:5173/login` → `teacher@example.com` / `password123`.
2. **Dashboard loads** showing stats (0 new submissions until you try as a student).
3. **Create a new assessment.** Teacher → Assessments → + New Assessment. Fill in
   the form → Save draft.
4. **Add a subjective question.** "Define a stack… 10 marks". Paste the reference
   answer. Build a 4-criterion rubric (Definition / Explanation / Key concepts /
   Example) with keywords.
5. **Add a programming question.** "Reverse an array". Choose Python. Add 5 test
   cases (input / expected / marks), one `visibility=hidden`.
6. **Publish.** On the assessment detail → "Publish". Validates rubric/test-case sums.
7. **Student login.** Incognito window → `student@example.com` / `password123`.
8. **Student dashboard** lists the new published assessment.
9. **Start attempt → submit subjective text answer.** Write a genuine answer.
10. **Write code for the programming question** in the Monaco editor → Submit.
    Backend calls Judge0 once per test case, waits, records per-case marks.
11. Back to **teacher login → Submissions**. The new submission now shows
    `status = submitted`.
12. Open the submission → **Run AI Evaluation**. Backend calls
    `POST /ai/evaluate-answer` → per-criterion marks are written. Status moves to
    `evaluated`.
13. **Teacher review.** Change one of the criterion marks from 2/2 to 1.5/2 and type
    a teacher feedback note. → Save review.
14. **Approve evaluation.** Now student view → Results shows the approved marks,
    grade, rank, and teacher feedback.

---

## 5. Handwritten answer demo

To exercise the OCR path without a real scanner:

1. Create a question of type `subjective_handwritten`.
2. As student, on the attempt page, click **Handwritten** tab → upload a small PNG.
   You can literally draw anything (even a blank image) — in `AI_USE_MOCK_MODE=true`
   mode TrOCR is stubbed out with a deterministic, filename-keyed paragraph.
3. As teacher, run Evaluate. The response will show:
   - `ocr_source = "mock"` in `subjective_answers.ocr_status`
   - The evaluation engine then scores the mock OCR text exactly like a typed answer.

To exercise **real** TrOCR on a machine with ≥ 8 GB RAM and 4 GB VRAM (or very slow
CPU):

1. Set `AI_USE_MOCK_MODE=false` in `.env`
2. Restart the ai-service. First start will download ~1.5 GB HuggingFace model.
3. Now upload a photo of real handwriting. `GET /ai/health` will show
   `trocr.model = microsoft/trocr-base-handwritten`.

---

## 6. Redis — what it actually does

Redis is not decorative. It's used by the backend for 3 meaningful things:

1. **Assessment read-through cache.** `GET /api/assessments/:id` and
   `GET /api/assessments` are cached under keys `cache:assessments:<id>` and
   `cache:assessments:list:<teacherId>` with TTL = 60 s. Writes (`PUT/DELETE/publish`)
   call `redis.invalidatePattern('cache:assessments:*')`.
2. **Evaluation job status.** While AI evaluation runs in-process, the service writes
   `job:eval:<submissionId>` = `queued → running → done` so polling from the UI can
   show a progress toast. TTL = 10 min.
3. **Submission dedupe.** When a student re-clicks submit twice, the backend checks
   `throttle:submit:<studentId>:<assessmentId>` with 5 s TTL and rejects the duplicate
   with 429-style response *before* touching the database.

If Redis is down the backend degrades gracefully: all reads/writes still happen via
Postgres, you just lose caching / polling / throttling. Health check reports
`redis: "down"` but continues HTTP 200.

---

## 7. Troubleshooting checklist

| Symptom                                                    | Likely cause + fix                                                                                                                       |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `PSSecurityException` running `.ps1` scripts               | PowerShell 5 policy. Prefer `.cmd` versions: `npm.cmd`, `npx.cmd`.                                                                       |
| `bcrypt` install fails on Windows                          | Backend uses `bcryptjs` (pure JS) to avoid this — never native `bcrypt`. You shouldn't hit this.                                         |
| Backend 500 on login / register                            | Schema not applied. Run `psql $DATABASE_URL -f database/schema.sql` then `-f database/seed.sql`.                                         |
| Seed login "Invalid email or password"                     | bcrypt hash in `seed.sql` got corrupted. Regenerate hash (§2.6) and replace the 3 rows.                                                  |
| Programming submissions always `internal_error` (0 marks)  | Judge0 CE is rate-limited / blocked. Wait and retry, or set `JUDGE0_USE_PUBLIC_CE=false` and run Judge0 locally.                          |
| Handwritten uploads 415 (Unsupported Media Type)           | Multer `fileFilter` only accepts `image/png, image/jpeg, image/jpg, application/pdf`. Check the file.                                   |
| Handwritten uploads 413 (Payload Too Large)                | Bump `MAX_UPLOAD_MB` in `.env` and also update `multer(limits: { fileSize: … })` if you edited manually.                                 |
| Docker: `ai-service` exits `code 1`                        | Memory limit too low (< 1 GB) in `docker-compose.yml` with AI_USE_MOCK_MODE=false. Raise `deploy.resources.limits.memory`.               |
| Docker: Postgres `permission denied` for the schema mount  | Windows: switch to WSL 2 backend; or (easier) just run `schema.sql` manually after `docker compose up -d postgres`.                     |
| CORS error in browser                                      | `CORS_ORIGINS` in `.env` must list the exact protocol + host + port the browser hits. Check if you changed `FRONTEND_PORT`.              |
| Vite can't reach backend via proxy                         | `frontend/vite.config.js` proxies `/api` → `http://localhost:4000`. Change if backend runs elsewhere.                                   |

---

## 8. Environment clean teardown (native mode)

```bash
# stop Node / Python / Vite with Ctrl-C first, then:
rm -rf backend/node_modules frontend/node_modules ai-service/.venv
rm -f .env frontend/.env backend/.env
rm -rf uploads/*
```

In Docker mode, as mentioned, `docker compose down -v` removes volumes too.
