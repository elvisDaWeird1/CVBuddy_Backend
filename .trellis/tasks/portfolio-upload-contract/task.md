# Portfolio upload contract

## Goal

Align Moment, experience cover, and Evidence upload rules at 5 MB per file.

## Scope

In: backend MIME/signature/size validation, Swagger/API contract, web preflight, and mobile contract documentation.

Out: mobile feature changes, storage migration, and AI modules.

## Decisions

- Moment: JPG/JPEG/PNG/WEBP/MP4; one to five files.
- Cover: JPG/JPEG/PNG/WEBP.
- Evidence: JPG/JPEG/PNG/WEBP/MP4/PDF/DOC/DOCX.
- Every file is non-empty and capped at 5 MB.

## Validation

- Command: `npm test && npm run build`
- Result: 55/55 backend tests passed; TypeScript build passed. Frontend policy tests, lint, and production build passed.
