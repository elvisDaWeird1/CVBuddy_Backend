# CVBuddy Backend MVP Plan

## 1. Purpose

This document is the main backend implementation plan for **CVBuddy MVP**.

CVBuddy is a career support platform that helps applicants and early-career users:

- Upload and manage CV files.
- Receive AI feedback, CV scoring, and Vietnamese-to-English CV translation.
- Build a personal portfolio.
- Upload event/activity photos from a mobile app to the portfolio, similar to a quick photo posting flow.
- Browse jobs, apply to jobs, and let companies manage basic job postings.
- Receive notifications for AI results and application-related events.

The backend must focus on the **MVP scope only**. Do not expand into the full future database unless explicitly approved.

---

## 2. Main Documents Codex Must Read First

Before coding, read these files in this order:

1. `README.md`
2. `BACKEND_MVP_PLAN.md`
3. `MVP_Database.txt`
4. `CVBuddy_RDS.docx`
5. `Full_Database.txt`

Important rule:

- `MVP_Database.txt` is the source of truth for current backend models and database design.
- `Full_Database.txt` is for future expansion only.
- Do not add fields, tables, models, or features from `Full_Database.txt` into MVP unless the user explicitly approves it.

---

## 3. Development Rules

Codex must follow these rules:

1. Do not code outside the MVP scope.
2. Do not change the database design without explaining the reason and asking for approval.
3. Do not rename models, fields, enums, or relationships from the MVP database unless technically necessary.
4. If the existing project already has a backend structure, keep it and adapt this plan to the current structure.
5. If the project has no backend yet, create a Node.js + Express.js + MongoDB/Mongoose backend.
6. Before modifying files, list:
   - Files to create.
   - Files to modify.
   - Reason for each change.
7. Use modular structure: route, controller, service, model, validation, middleware.
8. Protected APIs must use authentication middleware.
9. Role-based APIs must check user role.
10. AI output must be treated as advisory, not as final professional judgment.
11. Do not hardcode secrets, database URLs, or AI API keys.
12. Keep API responses consistent.
13. Keep README and API documentation updated after coding.

---

## 4. Backend Stack

Use the current project stack if already defined.

If no backend exists, use:

- Runtime: Node.js
- Framework: Express.js
- Database: MongoDB
- ODM: Mongoose
- Authentication: JWT
- Password hashing: bcrypt
- File upload: multer
- Environment variables: dotenv
- Validation: express-validator or zod
- API testing: Postman collection or API test guide
- File storage for MVP: local storage by default, unless the project already has Cloudinary/S3 configured

---

## 5. Suggested Project Structure

If the backend project has no structure yet, use this structure:

```txt
src/
  app.ts
  server.ts

  config/
    db.ts
    env.ts
    storage.ts

  constants/
    enums.ts

  modules/
    auth/
      auth.routes.ts
      auth.controller.ts
      auth.service.ts
      auth.validation.ts

    accounts/
      account.model.ts
      account.service.ts

    applicantProfiles/
      applicantProfile.model.ts
      applicantProfile.routes.ts
      applicantProfile.controller.ts
      applicantProfile.service.ts
      applicantProfile.validation.ts

    companyProfiles/
      companyProfile.model.ts
      companyProfile.routes.ts
      companyProfile.controller.ts
      companyProfile.service.ts
      companyProfile.validation.ts

    cvs/
      cvDocument.model.ts
      cv.routes.ts
      cv.controller.ts
      cv.service.ts
      cv.validation.ts

    ai/
      aiResult.model.ts
      ai.routes.ts
      ai.controller.ts
      ai.service.ts
      aiMock.service.ts
      ai.validation.ts

    portfolios/
      portfolio.model.ts
      portfolioItem.model.ts
      portfolio.routes.ts
      portfolio.controller.ts
      portfolio.service.ts
      portfolio.validation.ts

    jobs/
      job.model.ts
      job.routes.ts
      job.controller.ts
      job.service.ts
      job.validation.ts

    applications/
      application.model.ts
      application.routes.ts
      application.controller.ts
      application.service.ts
      application.validation.ts

    notifications/
      notification.model.ts
      notification.routes.ts
      notification.controller.ts
      notification.service.ts

    feedbacks/
      feedback.model.ts
      feedback.routes.ts
      feedback.controller.ts
      feedback.service.ts
      feedback.validation.ts

  middlewares/
    auth.middleware.ts
    role.middleware.ts
    error.middleware.ts
    upload.middleware.ts
    validate.middleware.ts

  utils/
    asyncHandler.ts
    apiError.ts
    apiResponse.ts
    jwt.ts
    file.ts

  seed/
    seedAdmin.ts
    seedSampleData.ts
```

If the current project already has a different structure, do not refactor the whole project. Add these modules in the existing style.

---

## 6. MVP Enums

Create shared enums in `src/constants/enums.ts` or define them inside each model.

```js
const ACCOUNT_ROLES = ["APPLICANT", "COMPANY", "ADMIN"];

const ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"];

const CV_LANGUAGES = ["VI", "EN"];

const CV_STATUSES = ["ACTIVE", "DELETED"];

const AI_TYPES = [
  "CV_FEEDBACK",
  "CV_TRANSLATION",
  "CV_SCORING",
  "JOB_RECOMMENDATION"
];

const AI_STATUSES = ["PENDING", "COMPLETED", "FAILED"];

const VISIBILITY_STATUSES = ["PRIVATE", "PUBLIC"];

const JOB_STATUSES = ["DRAFT", "ACTIVE", "CLOSED"];

const APPLICATION_STATUSES = [
  "SUBMITTED",
  "REVIEWING",
  "ACCEPTED",
  "REJECTED"
];

const NOTIFICATION_STATUSES = ["UNREAD", "READ"];
```

Use uppercase enum values exactly as defined in `MVP_Database.txt`.

---

## 7. MVP Models

### 7.1 Account Model

File:

```txt
src/modules/accounts/account.model.ts
```

Mongoose model:

```js
const AccountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["APPLICANT", "COMPANY", "ADMIN"],
      required: true
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      default: "ACTIVE",
      required: true
    }
  },
  {
    timestamps: true
  }
);

AccountSchema.index({ email: 1 }, { unique: true });
AccountSchema.index({ role: 1 });
AccountSchema.index({ status: 1 });
```

Rules:

- Do not return `passwordHash` to the client.
- Hash password with bcrypt.
- Login only works for `ACTIVE` accounts.
- Do not store `fullName` in Account. Applicant name belongs to ApplicantProfile. Company name belongs to CompanyProfile.

---

### 7.2 ApplicantProfile Model

File:

```txt
src/modules/applicantProfiles/applicantProfile.model.ts
```

Mongoose model:

```js
const ApplicantProfileSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      unique: true
    },

    fullName: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      trim: true
    },

    university: {
      type: String,
      trim: true
    },

    major: {
      type: String,
      trim: true
    },

    location: {
      type: String,
      trim: true
    },

    headline: {
      type: String,
      trim: true
    },

    summary: {
      type: String
    },

    careerGoal: {
      type: String
    },

    avatarUrl: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

ApplicantProfileSchema.index({ accountId: 1 }, { unique: true });
ApplicantProfileSchema.index({ fullName: "text", university: "text", major: "text" });
```

Rules:

- When an Applicant account is registered, create an ApplicantProfile automatically.
- An Applicant account has only one ApplicantProfile.
- Only the owner or Admin can view/update protected profile data.

---

### 7.3 CompanyProfile Model

File:

```txt
src/modules/companyProfiles/companyProfile.model.ts
```

Mongoose model:

```js
const CompanyProfileSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      unique: true
    },

    companyName: {
      type: String,
      required: true,
      trim: true
    },

    industry: {
      type: String,
      trim: true
    },

    websiteUrl: {
      type: String,
      trim: true
    },

    logoUrl: {
      type: String
    },

    description: {
      type: String
    },

    address: {
      type: String
    },

    contactEmail: {
      type: String,
      trim: true,
      lowercase: true
    },

    contactPhone: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

CompanyProfileSchema.index({ accountId: 1 }, { unique: true });
CompanyProfileSchema.index({ companyName: "text", industry: "text" });
```

Rules:

- When a Company account is registered, create a CompanyProfile automatically.
- MVP does not include company verification status.
- Company verification belongs to future/full database scope.

---

### 7.4 CVDocument Model

File:

```txt
src/modules/cvs/cvDocument.model.ts
```

Mongoose model:

```js
const CVDocumentSchema = new mongoose.Schema(
  {
    applicantProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApplicantProfile",
      required: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    fileUrl: {
      type: String,
      required: true
    },

    fileType: {
      type: String,
      trim: true
    },

    fileSize: {
      type: Number
    },

    language: {
      type: String,
      enum: ["VI", "EN"],
      default: "VI",
      required: true
    },

    extractedText: {
      type: String
    },

    status: {
      type: String,
      enum: ["ACTIVE", "DELETED"],
      default: "ACTIVE",
      required: true
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    timestamps: true
  }
);

CVDocumentSchema.index({ applicantProfileId: 1 });
CVDocumentSchema.index({ status: 1 });
CVDocumentSchema.index({ uploadedAt: -1 });
```

Rules:

- Only Applicant accounts can upload CVs.
- Only PDF/DOCX should be accepted.
- File size limit should be configurable by `.env`.
- Delete should be soft delete by setting `status = DELETED`.
- Do not add CV visibility, `isPrimary`, `deletedAt`, or CV versions in MVP.

---

### 7.5 AIResult Model

File:

```txt
src/modules/ai/aiResult.model.ts
```

Mongoose model:

```js
const AIResultSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },

    cvDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CVDocument"
    },

    relatedJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job"
    },

    aiType: {
      type: String,
      enum: [
        "CV_FEEDBACK",
        "CV_TRANSLATION",
        "CV_SCORING",
        "JOB_RECOMMENDATION"
      ],
      required: true
    },

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
      required: true
    },

    inputText: {
      type: String
    },

    resultText: {
      type: String
    },

    score: {
      type: Number,
      min: 0,
      max: 100
    },

    errorMessage: {
      type: String
    },

    completedAt: {
      type: Date
    }
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: false
    }
  }
);

AIResultSchema.index({ accountId: 1 });
AIResultSchema.index({ cvDocumentId: 1 });
AIResultSchema.index({ relatedJobId: 1 });
AIResultSchema.index({ aiType: 1 });
AIResultSchema.index({ status: 1 });
AIResultSchema.index({ createdAt: -1 });
```

Rules:

- Use `AIResult`, not `AIReview`.
- MVP uses `ai_results`, not `ai_requests`.
- Start with mock AI service if real AI provider is not configured.
- On success, save `COMPLETED`, `resultText`, optional `score`, and `completedAt`.
- On failure, save `FAILED` and `errorMessage`.
- Create a notification after AI completion or failure.

---

### 7.6 Portfolio Model

File:

```txt
src/modules/portfolios/portfolio.model.ts
```

Mongoose model:

```js
const PortfolioSchema = new mongoose.Schema(
  {
    applicantProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApplicantProfile",
      required: true,
      unique: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    introduction: {
      type: String
    },

    visibility: {
      type: String,
      enum: ["PRIVATE", "PUBLIC"],
      default: "PRIVATE",
      required: true
    },

    coverImageUrl: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

PortfolioSchema.index({ applicantProfileId: 1 }, { unique: true });
PortfolioSchema.index({ visibility: 1 });
```

Rules:

- One ApplicantProfile has one Portfolio.
- MVP does not include `slug`.
- If public portfolio endpoint is needed, use portfolio ID.
- Do not add `LINK_ONLY` in MVP.

---

### 7.7 PortfolioItem Model

File:

```txt
src/modules/portfolios/portfolioItem.model.ts
```

Mongoose model:

```js
const PortfolioItemSchema = new mongoose.Schema(
  {
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Portfolio",
      required: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String
    },

    imageUrl: {
      type: String
    },

    eventName: {
      type: String,
      trim: true
    },

    eventRole: {
      type: String,
      trim: true
    },

    eventDate: {
      type: Date
    },

    location: {
      type: String,
      trim: true
    },

    visibility: {
      type: String,
      enum: ["PRIVATE", "PUBLIC"],
      default: "PUBLIC",
      required: true
    },

    createdFromMobile: {
      type: Boolean,
      default: false,
      required: true
    }
  },
  {
    timestamps: true
  }
);

PortfolioItemSchema.index({ portfolioId: 1 });
PortfolioItemSchema.index({ visibility: 1 });
PortfolioItemSchema.index({ createdFromMobile: 1 });
PortfolioItemSchema.index({ createdAt: -1 });
```

Rules:

- Mobile photo upload creates a PortfolioItem.
- If uploaded from mobile, set `createdFromMobile = true`.
- MVP uses `imageUrl`, not `mediaUrl`.
- MVP does not include item type, thumbnail, organization name, display order, or skills table.
- If the user has no Portfolio, create a default private Portfolio before creating the item.
- Guest can only see public items inside a public portfolio.

---

### 7.8 Job Model

File:

```txt
src/modules/jobs/job.model.ts
```

Mongoose model:

```js
const JobSchema = new mongoose.Schema(
  {
    companyProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyProfile",
      required: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    location: {
      type: String,
      trim: true
    },

    jobType: {
      type: String,
      trim: true
    },

    description: {
      type: String,
      required: true
    },

    requirements: {
      type: String
    },

    benefits: {
      type: String
    },

    skillsText: {
      type: String
    },

    salaryText: {
      type: String
    },

    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "CLOSED"],
      default: "DRAFT",
      required: true
    },

    deadlineAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

JobSchema.index({ companyProfileId: 1 });
JobSchema.index({ status: 1 });
JobSchema.index({ deadlineAt: 1 });
JobSchema.index({
  title: "text",
  description: "text",
  requirements: "text",
  skillsText: "text",
  location: "text"
});
```

Rules:

- Only Company accounts can create jobs.
- Company can only update/close its own jobs.
- Guest and Applicant can only view `ACTIVE` jobs.
- MVP uses `jobType` and `skillsText` as simple text fields.
- Do not add job approval, job categories, or job skills table in MVP.

---

### 7.9 Application Model

File:

```txt
src/modules/applications/application.model.ts
```

Mongoose model:

```js
const ApplicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true
    },

    applicantProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApplicantProfile",
      required: true
    },

    cvDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CVDocument",
      required: true
    },

    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Portfolio"
    },

    coverLetter: {
      type: String
    },

    status: {
      type: String,
      enum: ["SUBMITTED", "REVIEWING", "ACCEPTED", "REJECTED"],
      default: "SUBMITTED",
      required: true
    },

    submittedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    timestamps: true
  }
);

ApplicationSchema.index(
  { jobId: 1, applicantProfileId: 1 },
  { unique: true }
);

ApplicationSchema.index({ applicantProfileId: 1 });
ApplicationSchema.index({ jobId: 1 });
ApplicationSchema.index({ status: 1 });
ApplicationSchema.index({ submittedAt: -1 });
```

Rules:

- One Applicant can apply to one Job only once.
- Applicant can only apply using their own CV.
- Applicant can only apply to `ACTIVE` jobs.
- Company can only view applications for jobs owned by its CompanyProfile.
- Notify Company when an Applicant applies.
- Notify Applicant when Company updates application status.
- MVP does not include withdraw application, status logs, or interview invitation.

---

### 7.10 Notification Model

File:

```txt
src/modules/notifications/notification.model.ts
```

Mongoose model:

```js
const NotificationSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    message: {
      type: String
    },

    type: {
      type: String,
      trim: true
    },

    status: {
      type: String,
      enum: ["UNREAD", "READ"],
      default: "UNREAD",
      required: true
    },

    readAt: {
      type: Date
    }
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: false
    }
  }
);

NotificationSchema.index({ accountId: 1 });
NotificationSchema.index({ status: 1 });
NotificationSchema.index({ createdAt: -1 });
```

Rules:

- Users can only view their own notifications.
- Mark as read by setting `status = READ` and `readAt = new Date()`.
- MVP does not include notification delete status.

---

### 7.11 Feedback Model

File:

```txt
src/modules/feedbacks/feedback.model.ts
```

Mongoose model:

```js
const FeedbackSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account"
    },

    fullName: {
      type: String,
      trim: true
    },

    email: {
      type: String,
      trim: true,
      lowercase: true
    },

    subject: {
      type: String,
      trim: true
    },

    message: {
      type: String,
      required: true
    }
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: false
    }
  }
);

FeedbackSchema.index({ accountId: 1 });
FeedbackSchema.index({ createdAt: -1 });
```

Rules:

- Guest can submit feedback without login.
- If the sender is logged in, store `accountId`.
- MVP does not include feedback status or resolution workflow.

---

## 8. MVP Model Relationships

```txt
Account 1 - 1 ApplicantProfile
Account 1 - 1 CompanyProfile
Account 1 - n AIResult
Account 1 - n Notification
Account 1 - n Feedback

ApplicantProfile 1 - n CVDocument
ApplicantProfile 1 - 1 Portfolio
ApplicantProfile 1 - n Application

CVDocument 1 - n AIResult
CVDocument 1 - n Application

Portfolio 1 - n PortfolioItem
Portfolio 1 - n Application

CompanyProfile 1 - n Job

Job 1 - n Application
Job 1 - n AIResult
```

---

## 9. MVP API Plan

Use `/api` prefix for all routes.

### 9.1 Foundation

```txt
GET /api/health
```

Response:

```json
{
  "success": true,
  "message": "CVBuddy backend is running"
}
```

---

### 9.2 Auth APIs

```txt
POST /api/auth/register/applicant
POST /api/auth/register/company
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
PATCH /api/auth/change-password
```

Register Applicant body:

```json
{
  "email": "applicant@example.com",
  "password": "Applicant@123",
  "fullName": "Nguyen Van A"
}
```

Register Company body:

```json
{
  "email": "company@example.com",
  "password": "Company@123",
  "companyName": "ABC Company"
}
```

Rules:

- Register Applicant creates Account + ApplicantProfile.
- Register Company creates Account + CompanyProfile.
- Login returns JWT token and account info without `passwordHash`.
- Change password requires current password.

---

### 9.3 Applicant Profile APIs

```txt
GET   /api/applicant-profile/me
PATCH /api/applicant-profile/me
```

Rules:

- Applicant can view/update own profile.
- Admin access can be added only if needed for MVP testing.

---

### 9.4 Company Profile APIs

```txt
GET   /api/company-profile/me
PATCH /api/company-profile/me
```

Rules:

- Company can view/update own company profile.
- MVP does not include company approval.

---

### 9.5 CV APIs

```txt
POST   /api/cvs
GET    /api/cvs
GET    /api/cvs/:id
DELETE /api/cvs/:id
```

Rules:

- Only Applicant can upload CV.
- Only owner can view/delete own CV.
- Delete means `status = DELETED`.

---

### 9.6 AI APIs

```txt
POST /api/ai/cvs/:cvId/feedback
POST /api/ai/cvs/:cvId/score
POST /api/ai/cvs/:cvId/translate-to-english
POST /api/ai/jobs/recommendations
GET  /api/ai/results
GET  /api/ai/results/:id
```

Rules:

- Applicant can request AI for their own CV.
- Start with mock AI if no real AI provider is configured.
- Store all AI outputs in `AIResult`.
- Create notification when AI task completes or fails.

---

### 9.7 Portfolio APIs

```txt
POST  /api/portfolios
GET   /api/portfolios/me
PATCH /api/portfolios/me
GET   /api/portfolios/public/:portfolioId
PATCH /api/portfolios/me/visibility
```

Rules:

- Applicant can create/update own portfolio.
- Public endpoint only returns portfolio if `visibility = PUBLIC`.
- Private portfolio is not visible to Guest.

---

### 9.8 Portfolio Item APIs

```txt
POST   /api/portfolio-items
GET    /api/portfolio-items/me
GET    /api/portfolio-items/:id
PATCH  /api/portfolio-items/:id
DELETE /api/portfolio-items/:id
POST   /api/mobile/portfolio/photos
```

Rules:

- `POST /api/mobile/portfolio/photos` receives image upload and creates PortfolioItem.
- If Applicant has no portfolio, create a default private portfolio first.
- Only owner can update/delete item.
- Guest can only see public items through public portfolio API.

---

### 9.9 Job APIs

```txt
POST   /api/jobs
GET    /api/jobs
GET    /api/jobs/:id
PATCH  /api/jobs/:id
PATCH  /api/jobs/:id/close
DELETE /api/jobs/:id
```

Rules:

- Company creates jobs.
- Company can only update/close/delete its own jobs.
- Guest and Applicant only see ACTIVE jobs.
- DELETE can soft-close or hard delete depending on existing project style. Prefer setting status to CLOSED for MVP.

---

### 9.10 Application APIs

```txt
POST  /api/applications
GET   /api/applications/me
GET   /api/company/applications
GET   /api/company/jobs/:jobId/applications
PATCH /api/company/applications/:id/status
```

Rules:

- Applicant applies to ACTIVE job with own CV.
- Prevent duplicate application for the same job.
- Company views applications for its own jobs.
- Company updates application status.
- Notifications:
  - New application -> notify Company.
  - Status update -> notify Applicant.

---

### 9.11 Notification APIs

```txt
GET   /api/notifications
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all
```

Rules:

- User can only access own notifications.
- MVP does not require notification delete.

---

### 9.12 Feedback APIs

```txt
POST /api/feedbacks
GET  /api/feedbacks
```

Rules:

- Guest or logged-in user can submit feedback.
- `GET /api/feedbacks` should be Admin-only if implemented.
- If Admin module is not implemented yet, only create POST feedback.

---

## 10. API Response Format

Success:

```json
{
  "success": true,
  "message": "Action completed successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Error message",
  "errors": []
}
```

Pagination:

```json
{
  "success": true,
  "message": "Data fetched successfully",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

---

## 11. Middleware Plan

### authMiddleware

Responsibilities:

- Read `Authorization: Bearer <token>`.
- Verify JWT.
- Attach account to `req.user`.
- Return 401 if token is missing or invalid.

### roleMiddleware

Responsibilities:

- Receive allowed roles.
- Return 403 if user role is not allowed.

Example:

```js
router.post("/jobs", authMiddleware, roleMiddleware("COMPANY"), createJob);
```

### uploadMiddleware

Responsibilities:

- Upload CV files and images.
- Validate file type.
- Validate file size.
- Store file locally or through configured storage driver.

### validateMiddleware

Responsibilities:

- Validate body, params, and query.
- Return consistent validation error format.

### errorMiddleware

Responsibilities:

- Catch all errors.
- Do not expose stack trace in production.
- Return consistent error response.

---

## 12. Environment Variables

Create or update `.env.example`.

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

Rules:

- Do not commit real `.env`.
- Do not hardcode secret values.
- If AI_PROVIDER is `mock`, backend should return mock AI results.

---

## 13. Implementation Order

Codex should code in this order:

1. Project setup and dependencies.
2. Express app, server, CORS, dotenv.
3. MongoDB connection.
4. Shared response/error utilities.
5. Account model.
6. Auth register/login/me/change-password.
7. Auth and role middleware.
8. ApplicantProfile and CompanyProfile models/APIs.
9. Upload middleware.
10. CVDocument model/APIs.
11. AIResult model and mock AI service.
12. AI APIs.
13. Notification model/APIs.
14. Portfolio and PortfolioItem models/APIs.
15. Mobile photo upload API.
16. Job model/APIs.
17. Application model/APIs.
18. Feedback model/API.
19. Seed admin/applicant/company data.
20. README and API documentation update.
21. Postman test guide or collection.

---

## 14. Testing Checklist

### Auth

- Register Applicant successfully.
- Register Company successfully.
- Duplicate email fails.
- Login successfully.
- Invalid credentials fail.
- Get current user with token.
- Protected API without token returns 401.
- Change password works.

### Profile

- Applicant can get/update own profile.
- Company can get/update own profile.
- Applicant cannot access company-only APIs.
- Company cannot access applicant-only APIs.

### CV

- Applicant uploads PDF/DOCX CV.
- Wrong file type fails.
- Applicant gets own CV list.
- Applicant views own CV detail.
- Applicant cannot view another applicant's CV.
- Delete CV sets status to DELETED.

### AI

- Request CV feedback.
- Request CV scoring.
- Request CV translation.
- AI result is saved.
- AI failure saves FAILED status.
- AI completed/failed creates notification.

### Portfolio

- Applicant creates portfolio.
- Applicant updates portfolio.
- Applicant uploads portfolio item from web.
- Applicant uploads photo from mobile endpoint.
- Mobile photo appears in portfolio item list.
- Public portfolio can be viewed by Guest only if visibility is PUBLIC.
- Private portfolio is not publicly accessible.

### Job

- Company creates job.
- Company updates own job.
- Company closes own job.
- Guest/Applicant can view ACTIVE jobs.
- Guest/Applicant cannot view DRAFT jobs.

### Application

- Applicant applies to ACTIVE job.
- Applicant cannot apply twice to the same job.
- Applicant cannot apply using another applicant's CV.
- Company sees applications for own jobs.
- Company updates application status.
- Notifications are created for application events.

### Notification

- User sees own notifications.
- User marks one notification as read.
- User marks all notifications as read.

### Feedback

- Guest submits feedback.
- Logged-in user submits feedback with accountId.

---

## 15. Seed Data

Create seed script for development:

Required seed accounts:

```txt
admin@example.com / Admin@123
applicant@example.com / Applicant@123
company@example.com / Company@123
```

Seed should create:

- 1 Admin account.
- 1 Applicant account + ApplicantProfile.
- 1 Company account + CompanyProfile.
- 1 sample Portfolio.
- 2 sample PortfolioItems.
- 1 sample Job.

Do not use real passwords in production. These are for local development only.

---

## 16. Out of Scope for MVP

Do not code these unless the user explicitly approves:

```txt
oauth_accounts
password_reset_tokens
account_deletion_requests
skills
applicant_skills
job_categories
cv_versions
ai_requests
job_recommendations table
candidate_recommendations
portfolio_item_skills
portfolio_views
job_skills
job_approval_logs
saved_jobs
application_status_logs
interview_invitations
system_announcements
announcement_recipients
reports
admin_audit_logs
company verification
job approval
advanced moderation
dashboard statistics
AI matched candidates
CV-job comparison
CV improvement for selected job
portfolio AI improvement
service discovery or microservice architecture
```

Note:

- AI job recommendation is included in MVP only as `AIResult` with `aiType = JOB_RECOMMENDATION`.
- Do not create a separate `job_recommendations` table in MVP.

---

## 17. Definition of Done

Backend MVP is complete when:

1. Server runs without error.
2. MongoDB connects successfully.
3. `.env.example` is available.
4. Applicant can register/login.
5. Company can register/login.
6. Passwords are hashed.
7. JWT authentication works.
8. Role-based access works.
9. ApplicantProfile and CompanyProfile are created on registration.
10. Applicant can upload/list/view/delete CV.
11. AI feedback/scoring/translation APIs work with mock or configured provider.
12. AI results are saved in `ai_results`.
13. AI completion/failure creates notifications.
14. Applicant can create/update portfolio.
15. Mobile photo upload creates PortfolioItem.
16. Public portfolio visibility works.
17. Company can create/manage jobs.
18. Applicant can apply to jobs.
19. Company can view applications and update status.
20. Application notifications work.
21. Feedback form works.
22. API response format is consistent.
23. README is updated.
24. Postman test guide or collection is available.
25. No model or feature is added outside MVP scope without approval.

---

## 18. Final Reminder for Codex

The current goal is not to build the entire CVBuddy platform.

The current goal is to build a clean, working, testable backend MVP based on `MVP_Database.txt`.

Keep the code simple, modular, and aligned with the approved MVP database.
