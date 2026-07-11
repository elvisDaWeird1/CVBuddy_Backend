# API Contract

This document is the source of truth for intended public CVBuddy backend API behavior and response contracts. `src/docs/swagger.paths.ts` is the implementation source used to generate Swagger/OpenAPI documentation and should stay aligned with this file.

If this file and `src/docs/swagger.paths.ts` disagree, do not guess. Inspect the route and controller code, then reconcile the mismatch according to the current task or report it clearly.

## General

- All paths below are full API paths with the `/api` prefix.
- Swagger UI: `/api/docs`
- OpenAPI JSON: `/api/docs.json`
- Protected routes use `Authorization: Bearer <token>`.
- Success response shape: `{ success: true, message, data? }`.
- Error response shape: `{ success: false, message, errors }`.

## Current Routes

- `GET /api/health`
- `POST /api/auth/register/applicant`
- `POST /api/auth/register/company`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/change-password`
- `GET /api/applicant-profile/me`
- `PATCH /api/applicant-profile/me`
- `POST /api/uploads/avatar`
- `POST /api/uploads/portfolio-photo`
- `POST /api/uploads/cv`
- `GET /api/uploads/cv/:id/download`
- `POST /api/cvs`
- `GET /api/cvs`
- `GET /api/cvs/:id`
- `DELETE /api/cvs/:id`
- `POST /api/ai/cvs/:cvId/feedback`
- `POST /api/ai/cvs/:cvId/score`
- `POST /api/ai/cvs/:cvId/translate-to-english`
- `GET /api/ai/results`
- `GET /api/ai/results/:id`
- `POST /api/portfolios`
- `GET /api/portfolios/me`
- `PATCH /api/portfolios/me`
- `GET /api/portfolios/public/:portfolioId`
- `POST /api/portfolio-items`
- `GET /api/portfolio-items/me`
- `GET /api/portfolio-items/:id`
- `PATCH /api/portfolio-items/:id`
- `DELETE /api/portfolio-items/:id`
- `POST /api/mobile/portfolio/photos`

## Logout Behavior

Logout revokes the presented bearer token on the server. Reusing that token on a protected endpoint returns `401`.

## Upload APIs

All upload APIs require an Applicant JWT:

```txt
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Cloudinary credentials must be configured only on the backend:

```txt
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Backend decides Cloudinary folders by endpoint:

- `POST /api/uploads/avatar` -> `cvbuddy/applicant-avatar`, public id `<userId>-avatar`.
- `POST /api/uploads/portfolio-photo` -> `cvbuddy/portfolio`, public id `<userId>-<timestamp>`.
- `POST /api/uploads/cv` -> `cvbuddy/cvs`, public id `<userId>-<timestamp>-<original-file-name.ext>`, `resource_type: "raw"`.
- `POST /api/cvs` -> `cvbuddy/cvs`, public id `<userId>-<timestamp>-<original-file-name.ext>`, `resource_type: "raw"`.
- `POST /api/mobile/portfolio/photos` -> `cvbuddy/portfolio`, public id `<userId>-<timestamp>`.

Upload my avatar and update my applicant profile:

```txt
POST /api/uploads/avatar
```

Form-data:

```txt
avatar: JPG, JPEG, PNG, or WEBP file, max 5MB
```

Success response:

```json
{
  "success": true,
  "message": "Upload successful",
  "data": {
    "url": "https://res.cloudinary.com/demo/image/upload/v1711111111/cvbuddy/applicant-avatar/66a111111111111111111111-avatar.jpg",
    "secureUrl": "https://res.cloudinary.com/demo/image/upload/v1711111111/cvbuddy/applicant-avatar/66a111111111111111111111-avatar.jpg",
    "publicId": "cvbuddy/applicant-avatar/66a111111111111111111111-avatar",
    "resourceType": "image",
    "format": "jpg",
    "bytes": 204800,
    "originalFilename": "avatar.jpg",
    "profile": {}
  }
}
```

Upload a standalone portfolio photo:

```txt
POST /api/uploads/portfolio-photo
```

Form-data:

```txt
image: JPG, JPEG, PNG, or WEBP file, max 5MB
```

Upload a standalone CV file:

```txt
POST /api/uploads/cv
```

Form-data:

```txt
file: PDF, DOC, or DOCX file, max 10MB
```

CV uploads also return and store metadata for download:

```json
{
  "originalName": "Nguyen Van A CV.docx",
  "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "size": 512000,
  "publicId": "cvbuddy/cvs/66a111111111111111111111-1783000000000-nguyen-van-a-cv.docx",
  "resourceType": "raw"
}
```

Download a saved CV with original filename:

```txt
GET /api/uploads/cv/:id/download
```

This endpoint requires an Applicant JWT, checks ownership against the saved CV document, proxies the Cloudinary file through backend, and sets:

```http
Content-Disposition: attachment; filename*=UTF-8''<encoded originalName>
Content-Type: <saved mimeType or application/octet-stream>
```

Common upload error:

```json
{
  "success": false,
  "message": "Only JPG, JPEG, PNG, and WEBP image files are allowed",
  "errors": [
    {
      "field": "image",
      "message": "File must be .jpg, .jpeg, .png, or .webp"
    }
  ]
}
```

Existing feature upload routes also use Cloudinary:

- `POST /api/cvs` stores `fileUrl`, `filePublicId`, and `fileResourceType` on the CV document.
- `POST /api/mobile/portfolio/photos` stores `imageUrl` and `imagePublicId` on the created portfolio item.
- `DELETE /api/cvs/:id` and `DELETE /api/portfolio-items/:id` delete the Cloudinary resource when a public id is available.

Do not change these contracts without an explicit API task.
