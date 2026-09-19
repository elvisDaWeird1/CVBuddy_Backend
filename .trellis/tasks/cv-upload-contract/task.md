# CV upload contract

## Goal

Lock new CV uploads to PDF/DOCX with a maximum size of 5 MB.

## Scope

In: upload metadata/content validation, exact size boundaries, public non-AI docs, and legacy DOC download messaging.

Out: AI services/adapters, CV schema changes, deleting or migrating legacy CV records.

## Files touched

- `src/middlewares/upload.middleware.ts`
- `src/utils/uploadFile.ts`
- `src/modules/uploads/upload.controller.ts`
- CV upload tests and public documentation

## Notes

- Legacy DOC records remain listable and downloadable.
- PDF remains the only inline-preview format.

## Validation

- Command: `npm test && npm run build`
- Result: 50/50 backend tests and 29/29 frontend tests passed; backend/frontend builds and frontend lint passed.

## Follow-up

- Frontend picker, validation, legacy DOC messaging, and copy are aligned.
