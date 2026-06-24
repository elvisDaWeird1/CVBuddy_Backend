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

The source of truth for MVP database design is:

```txt
MVP_Database.txt
```

Do not add models, fields, tables, APIs, or features from `Full_Database.txt` unless the user explicitly approves it.

## Main Documents to Read

Read these files before coding:

1. `README.md`
2. `BACKEND_MVP_PLAN.md`
3. `MVP_Database.txt`
4. `CVBuddy_RDS.docx`
5. `Full_Database.txt`

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

## Coding Rules for Codex

- Do not expand outside MVP scope.
- Do not change the database design without approval.
- Do not add future/full-database models unless requested.
- Keep model fields aligned with `MVP_Database.txt`.
- Use modular structure: model, route, controller, service, validation, middleware.
- Use JWT for protected APIs.
- Use role-based access for Applicant, Company, and Admin APIs.
- Treat AI output as suggestions only.
- Keep API response format consistent.
- Update documentation after coding.

## MVP Reminder

Focus on building a clean, working backend MVP first.

Future features such as OAuth, password reset, job approval, skill tables, CV versions, advanced moderation, audit logs, and AI matched candidates are not part of the current MVP unless explicitly approved.
