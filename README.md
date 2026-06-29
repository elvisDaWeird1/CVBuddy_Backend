# CVBuddy Backend

## What is CVBuddy?

CVBuddy is a career support platform for applicants and early-career users.

The MVP backend supports:

- Account registration and login for Applicant, Company, and Admin.
- Applicant profile and company profile.
- CV upload and management.
- AI CV feedback, CV scoring, CV translation, and basic job recommendation result storage.
- Portfolio creation and mobile photo upload to portfolio.
- Job posting by companies.
- Job application by applicants.
- Notifications and feedback form.

## Backend Stack

Use the existing project stack if already configured.

Default backend stack:

- Node.js
- TypeScript
- Express.js
- MongoDB
- Mongoose
- JWT authentication
- bcrypt password hashing
- multer file upload
- dotenv environment variables

## MVP Scope

This project is currently coding the **MVP only**.

Current backend references:

- `docs/database.md` is the human-readable database reference.
- Mongoose model/schema files are the implementation source for current database behavior.
- `docs/api-contract.md` is the public API contract reference.
- `BACKEND_MVP_PLAN.md` is a planning reference, not mandatory reading for every small task.

If older planning files such as `MVP_Database.txt`, `CVBuddy_RDS.docx`, or `Full_Database.txt` are added later, use them only for scope or schema decisions and reconcile them with the current code and docs.

## How to Run

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Set at least `MONGODB_URI` in `.env` before starting the server:

```txt
MONGODB_URI=mongodb://127.0.0.1:27017/cvbuddy
```

Run in development mode:

```bash
npm run dev
```

Build TypeScript:

```bash
npm run build
```

Start production from `dist`:

```bash
npm start
```

Health check:

```txt
GET /api/health
```

Example:

```bash
curl http://localhost:5000/api/health
```

Expected response:

```json
{
  "success": true,
  "message": "CVBuddy backend is running"
}
```

## API Documentation

Run the backend:

```bash
npm run dev
```

Open Swagger UI:

```txt
http://localhost:5000/api/docs
```

Open OpenAPI JSON:

```txt
http://localhost:5000/api/docs.json
```

Test protected APIs:

1. Call `POST /api/auth/login`.
2. Copy token from response.
3. Click Authorize in Swagger UI.
4. Paste the JWT token.
5. Test protected APIs.

## Phase 2 Authentication APIs

Base URL:

```txt
http://localhost:5000/api
```

Register an applicant:

```txt
POST /auth/register/applicant
```

```json
{
  "email": "applicant@example.com",
  "password": "Applicant@123",
  "fullName": "Nguyen Van A"
}
```

Register a company:

```txt
POST /auth/register/company
```

```json
{
  "email": "company@example.com",
  "password": "Company@123",
  "companyName": "ABC Company"
}
```

Login:

```txt
POST /auth/login
```

```json
{
  "email": "applicant@example.com",
  "password": "Applicant@123"
}
```

Protected APIs require:

```txt
Authorization: Bearer <token>
```

Current account:

```txt
GET /auth/me
```

Change password:

```txt
PATCH /auth/change-password
```

```json
{
  "currentPassword": "Applicant@123",
  "newPassword": "NewPassword@123"
}
```

Logout:

```txt
POST /auth/logout
```

## Phase 3 Applicant Profile APIs

Both endpoints require an applicant JWT:

```txt
Authorization: Bearer <token>
```

Get my applicant profile:

```txt
GET /applicant-profile/me
```

Update my applicant profile:

```txt
PATCH /applicant-profile/me
```

```json
{
  "phone": "0900000000",
  "university": "FPT University",
  "major": "Software Engineering",
  "location": "Can Tho",
  "headline": "Junior Backend Developer",
  "summary": "I am looking for internship opportunities.",
  "careerGoal": "Become a backend developer.",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

## Phase 4 CV Management APIs

All CV endpoints require an applicant JWT:

```txt
Authorization: Bearer <token>
```

Upload a CV:

```txt
POST /cvs
Content-Type: multipart/form-data
```

Form-data:

```txt
file: PDF or DOCX file
title: My Backend Developer CV
language: VI or EN
```

Get my CV list:

```txt
GET /cvs
```

Get CV detail:

```txt
GET /cvs/:id
```

Soft delete CV:

```txt
DELETE /cvs/:id
```

## Phase 5 AI CV APIs

AI endpoints require an applicant JWT:

```txt
Authorization: Bearer <token>
```

If `AI_PROVIDER=mock` or no `AI_API_KEY` is configured, the backend returns mock AI responses.

Generate CV feedback:

```txt
POST /ai/cvs/:cvId/feedback
```

Generate CV score:

```txt
POST /ai/cvs/:cvId/score
```

Translate CV to English:

```txt
POST /ai/cvs/:cvId/translate-to-english
```

Optional body when the uploaded CV has no extracted text:

```json
{
  "targetRole": "Backend Developer",
  "cvText": "Paste CV text here if extractedText is empty."
}
```

Get my AI result history:

```txt
GET /ai/results
```

Get AI result detail:

```txt
GET /ai/results/:id
```

## Phase 6 Portfolio & Mobile Photo APIs

Portfolio endpoints use local storage for uploaded photos in `uploads/portfolio`.

Applicant portfolio APIs require an applicant JWT:

```txt
Authorization: Bearer <token>
```

Create my portfolio:

```txt
POST /portfolios
```

Get or update my portfolio:

```txt
GET /portfolios/me
PATCH /portfolios/me
```

View a public portfolio:

```txt
GET /portfolios/public/:portfolioId
```

Create and manage my portfolio items:

```txt
POST /portfolio-items
GET /portfolio-items/me
GET /portfolio-items/:id
PATCH /portfolio-items/:id
DELETE /portfolio-items/:id
```

Upload a portfolio photo from mobile:

```txt
POST /mobile/portfolio/photos
Content-Type: multipart/form-data
```

Form-data:

```txt
image: JPG, JPEG, PNG, or WEBP file
title: Career Workshop Photo
description: Photo from today's workshop
eventName: Career Workshop 2026
eventRole: Participant
eventDate: 2026-06-20
location: Can Tho
visibility: PUBLIC
```

## Environment Variables

Example `.env`:

```txt
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/cvbuddy
JWT_SECRET=change_me
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10

STORAGE_DRIVER=local
UPLOAD_DIR=uploads
MAX_CV_FILE_SIZE_MB=10
MAX_IMAGE_FILE_SIZE_MB=5

AI_PROVIDER=mock
AI_API_KEY=
AI_MODEL=
```

Do not commit real `.env` values.

## Backend Agent Guidance

Detailed Codex guidance lives in `AGENTS.md`. Keep this README focused on human setup and API usage.

For backend changes, preserve existing MVP contracts unless a task explicitly changes them: API paths, response format, schema fields, enum values, JWT behavior, upload behavior, and environment variable names.

## MVP Reminder

Focus on building a clean, working backend MVP first.

Future features such as OAuth, password reset, job approval, skill tables, CV versions, advanced moderation, audit logs, and AI matched candidates are not part of the current MVP unless explicitly approved.
