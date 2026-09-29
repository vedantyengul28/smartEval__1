# SmartEval — AI-Assisted Automated Answer Evaluation Platform

> Final-Year Engineering Project · Full-Stack + AI/ML

SmartEval is an **AI-assisted automated answer evaluation platform** for educational institutions.
Teachers create assessments with rubrics; students submit text, handwritten (scanned), or programming answers.
The system uses **SBERT** semantic similarity, **TrOCR** handwriting OCR, and rubric-based heuristics to generate marks and feedback.
Teachers review, adjust, and approve AI-generated results before students see them.

Programming solutions are executed via [Judge0](https://judge0.com/) against teacher-defined test cases with per-case scoring.

---

## ✨ Features

| Module | Capabilities |
|---|---|
| 🔐 **Authentication** | JWT + bcrypt, role-based auth (teacher / student) |
| 📑 **Assessments** | Create questions, rubrics; publish workflow |
| ✍️ **Submissions** | Typed text answer, image/PDF upload |
| 🤖 **AI Service** (FastAPI - Optional) | TrOCR OCR → SBERT semantic similarity → rubric weighted scoring → per-criterion reasons & overall feedback |
| 👩‍🏫 **Teacher Review** | Override marks, add notes, approve evaluations |
| � **Database** | SQLite for local development (easily portable) |

---

## 🏛️ Architecture (High Level)

```
              React + Tailwind
                      |  REST API
                      ↓
           Node.js + Express + JWT
                      ↓
                  SQLite
```

**Note:** This is a simplified SQLite-based version for local development. The original architecture with PostgreSQL, Redis, and AI Service is available in the project history.

---

## 🛠️ Tech Stack

### Frontend
- **React 18 + Vite**
- **Tailwind CSS 3**
- **React Router v6**
- **Axios**

### Backend
- **Node.js 20 + Express**
- **JWT** (jsonwebtoken) + **bcryptjs**
- **SQLite3** (local file-based database)
- **Multer** for file uploads (PNG/JPG/JPEG/PDF)
- **Helmet**, **CORS**, **express-rate-limit** for basic hardening
- **Zod** for request validation

### AI Evaluation (Optional)
- Built-in mock evaluation with keyword matching and heuristic scoring
- Can be extended with external AI service for advanced evaluation

---

## 🚀 Local Setup

### Prerequisites
- Node.js 20+
- npm or yarn

### Backend Setup

```bash
cd backend
npm install
node src/server.js
```

Backend runs on http://localhost:5000

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

### Environment Variables

Backend uses the following environment variables (create `.env` in backend directory):

```env
NODE_ENV=development
PORT=5000
JWT_SECRET=smarteval_secret_key_123
JWT_EXPIRES_IN=7d
DATABASE_TYPE=sqlite
DATABASE_PATH=./database/smarteval.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_IMAGE_TYPES=png,jpg,jpeg,pdf
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TIMEOUT=60000
CORS_ORIGIN=http://localhost:5173
```

### Demo Accounts

You can register new accounts via the API or frontend:
- Teacher role: Create assessments, questions, rubrics, review submissions
- Student role: View published assessments, submit answers, view results

---

## 📁 Project Structure

```
SmartEval/
├── backend/                  Node.js + Express API
│   ├── database/             SQLite database file
│   │   ├── db.js             Database connection & table creation
│   │   └── smarteval.db      SQLite database file
│   ├── src/
│   │   ├── config/           env configuration
│   │   ├── controllers/      one per resource
│   │   ├── routes/           REST routes
│   │   ├── services/         business logic
│   │   ├── middleware/       auth, error-handler, upload
│   │   └── utils/            errors, validators (zod), helpers
│   └── package.json
├── frontend/                 React + Tailwind
│   └── src/
│       ├── pages/            teacher, student, auth
│       ├── layouts/
│       ├── context/          Auth
│       ├── services/         axios wrappers
│       └── components/       shared UI
└── .env                     Environment variables
```

---

## 🧪 Demo Flows End-to-End

### Subjective Workflow
1. **Teacher** registers/logs in → creates Assessment → adds Subjective Question → adds rubric criteria → adds model answer → **Publish**.
2. **Student** registers/logs in → views Published Assessments → submits text answer or uploads file.
3. **Teacher** views Submission → triggers **AI Evaluation** (mock keyword matching or external AI service).
4. **Teacher** reviews AI marks, adds feedback → **Approves** evaluation.
5. **Student** views results with marks, feedback, and teacher notes.

---

## ⚠️ Notes

- **Database**: SQLite file is auto-created at `backend/database/smarteval.db` on first run
- **AI Evaluation**: Built-in mock evaluation uses keyword matching. External AI service can be configured via `AI_SERVICE_URL`
- **File Uploads**: Stored in `backend/uploads/` directory
- **No Docker Required**: This version runs natively without Docker containers

---

## 🧑‍🏫 License & Credits

Academic final-year project. Built for educational demonstration only.