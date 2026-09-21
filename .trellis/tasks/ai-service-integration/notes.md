# Notes

## Audit

- Backend is a separate Git repository with pre-existing uncommitted Portfolio changes; those changes must be preserved.
- Existing AI routes authenticate and require Applicant role. Ownership is enforced by loading the ApplicantProfile for the authenticated account and then finding an active CV by `applicantProfileId`.
- `CVDocument.fileUrl` currently points to local `/uploads/cvs/<filename>` storage. `cv.service.ts` extracts text locally, but does not store FastAPI-compatible structured sections.
- Existing `AIResult` stores `accountId`, optional `cvDocumentId`, `aiType`, status, inputText, resultText, score, errorMessage, and timestamps. No raw JSON field or request fingerprint exists.
- Existing `ai.service.ts` uses `buildMockAiResult`; production FastAPI failures must not fall back to this result.
- FastAPI `cvbuddy-ai` is independent and remains untouched. Its primary routes are `/v1/*`; `/ai/*` aliases are also mounted. The Node adapter will use `/v1/*`.
- FastAPI analyze requires structured sections plus `industry_slug`; it does not accept the Node legacy `targetRole` directly. The adapter maps `targetRole` to `jd_extract.role_title` and uses a configurable default industry.
- FastAPI extraction accepts multipart `file` and supports PDF/DOCX. Node sends the locally stored CV bytes to `/v1/cv/extract`, then sends the returned sections/metrics to `/v1/cv/analyze`.
- FastAPI translation requires `{ text, source_lang, target_lang, mode, tier }` and returns `{ translated, notes, meta }`.
- FastAPI portfolio endpoints are typed in the adapter only; no new public Node Portfolio route is added in this task.

## Decisions

- Use native Node `fetch`, `AbortController`, `FormData`, and `Blob`; no HTTP dependency is added.
- `AI_SERVICE_ENABLED` defaults to `true`. Set it explicitly to `false` for local/test mock mode.
- Default URL is `http://localhost:8001`; Docker users can set `AI_SERVICE_URL=http://host.docker.internal:8001` when FastAPI runs separately, or `http://ai:8000` when both services share a compose network.
- Map FastAPI transport failures to 503/504, 4xx validation to safe 422/429 responses, 5xx to 502, and invalid JSON/schema to 502.
- Store the validated FastAPI response as JSON in the existing `AIResult.resultText`; set `score` only for the scoring action. No database migration is needed.
- Analyze and score each create their existing AIResult type; no unsafe cross-action cache is introduced because the current schema has no request fingerprint for industry/JD/model options.


## Implementation and validation history

- Added ai.config.ts for normalized URL, timeout, enabled flag, and FastAPI defaults; added a typed native-fetch client under src/modules/ai/clients/.
- Preserved the public Node AI routes and applicant ownership checks. Production/default execution now calls FastAPI; the existing mock provider is reachable only when AI_SERVICE_ENABLED=false.
- Analyze/score use FastAPI /v1/cv/extract-and-analyze by default; they use /v1/cv/extract followed by /v1/cv/analyze when targetRole/JD or subscription tier must be preserved. Translation uses /v1/translate. Portfolio suggestion methods are available on the adapter but no new public route or automatic persistence was added.
- Added boundary/service tests and docs/ai-service-integration.md. Backend npm run build passed and npm test passed 16/16.
- Built the independent FastAPI image and verified /health and /v1/models returned HTTP 200 with the mock provider. The temporary validation container was removed afterward.
- docker compose -f docker-compose.dev.yml config passed. The outer repository still shows cvbuddy/ as an unstaged untracked nested repository; the nested repository itself remains clean.
- No commit or push was performed.

- Added a regression test confirming analysis proceeds from the stored PDF when CVDocument.extractedText is empty; text is still required for translation and explicit mock mode.
