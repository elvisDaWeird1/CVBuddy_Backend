# FastAPI AI Service Integration

## Architecture

The independent FastAPI repository remains outside the main repository:

```text
Frontend / Mobile -> Node backend (/api/ai/*) -> FastAPI cvbuddy-ai (/v1/*) -> Groq / Ollama / Mock
```

The Node backend owns authentication, applicant/CV ownership, public response formatting, AIResult persistence, and safe error mapping. Frontend and mobile must not call FastAPI directly. No file under `D:\KI 7\cvbuddy\cvbuddy` is part of this integration change.

## Source of truth

- Repository: `D:\KI 7\cvbuddy\cvbuddy`
- Service: `D:\KI 7\cvbuddy\cvbuddy\cvbuddy-ai`
- Contract: `cvbuddy-ai/docs/AI_CONTRACT.md` and its FastAPI schemas/routes
- Primary FastAPI prefix used by Node: `/v1`

The FastAPI service also mounts `/ai` aliases, but Node uses `/v1` because that is the configured frontend path.

## Environment

```env
AI_SERVICE_URL=http://localhost:8001
AI_SERVICE_TIMEOUT_MS=60000
AI_SERVICE_ENABLED=true
AI_DEFAULT_INDUSTRY_SLUG=language
AI_DEFAULT_VERTICAL_SLUG=
AI_DEFAULT_COMPANY_MODEL=corporate
AI_DEFAULT_LANGUAGE=both
AI_DEFAULT_TIER=free
AI_SUPPORTED_INDUSTRY_SLUGS=ai_software,business_administration,computer_science,language,law,marketing
```

- `AI_SERVICE_ENABLED=true` is the normal path and calls FastAPI.
- Set `AI_SERVICE_ENABLED=false` explicitly for local/test mock mode.
- FastAPI failure never silently falls back to a successful mock result.
- `AI_SERVICE_URL` is normalized without a trailing slash.
- `AI_SERVICE_TIMEOUT_MS` controls the AbortController timeout.
- `AI_DEFAULT_INDUSTRY_SLUG` preserves compatibility with old clients that only send `targetRole`/`cvText`; new clients should send `industrySlug` when known.
- Groq/Ollama credentials remain only in the FastAPI repository `.env`.

## Local startup

### FastAPI with mock provider

```powershell
cd "D:\KI 7\cvbuddy\cvbuddy\cvbuddy-ai"
Copy-Item .env.example .env
```

Set `LLM_PROVIDER=mock` and `MOCK_LLM=true` in the copied `.env`, then run:

```powershell
docker compose up --build
```

FastAPI is exposed at `http://localhost:8001`; health is `GET http://localhost:8001/health`.

### Node backend

```powershell
cd "D:\KI 7\cvbuddy\backend"
npm ci
npm run dev
```

The backend still needs its normal MongoDB/JWT environment. Set `AI_SERVICE_URL=http://localhost:8001` in `backend/.env`.

### Docker networking

If Node runs inside Docker while FastAPI runs on the Windows host, use:

```env
AI_SERVICE_URL=http://host.docker.internal:8001
```

If both services later share a Compose network, use:

```env
AI_SERVICE_URL=http://ai:8000
```

The outer Compose file is not changed to build the nested AI repository because other clones do not contain that independent repository, and the current backend Dockerfile is not present in this checkout. Run FastAPI separately for now.

## Node public route mapping

| Node route | FastAPI calls | Stored result |
| --- | --- | --- |
| `POST /api/ai/cvs/:cvId/feedback` | `/v1/cv/extract-and-analyze` by default; two-step `/extract` + `/analyze` when JD/tier context is needed | `CV_FEEDBACK` |
| `POST /api/ai/cvs/:cvId/score` | `/v1/cv/extract-and-analyze` by default; two-step `/extract` + `/analyze` when JD/tier context is needed | `CV_SCORING, score=overall_score` |
| `POST /api/ai/cvs/:cvId/translate-to-english` | `/v1/translate` | `CV_TRANSLATION` |
| `GET /api/ai/results` | MongoDB only | Existing response |
| `GET /api/ai/results/:id` | MongoDB only | Existing response |

The Node public route names and response wrapper are unchanged.

## Analyze flow

The current CV storage uses local `/uploads/cvs/<filename>` paths. For analysis, Node:

1. Authenticates the applicant and verifies the CV belongs to that account.
2. Resolves the persisted local or trusted Cloudinary PDF/DOCX through the source adapter and enforces the configured size limit.
3. When there is no JD context and the requested tier is free, sends the file as multipart field `file` to `POST /v1/cv/extract-and-analyze` with the supported query parameters.
4. When `targetRole`, `jdExtract`, or subscription tier must be preserved, sends the file to `POST /v1/cv/extract`, then sends the returned `sections` and `local_metrics` to `POST /v1/cv/analyze`.
5. Stores the validated FastAPI response as JSON in `AIResult.resultText`.

The legacy `targetRole` field maps to FastAPI `jd_extract.role_title`. Optional compatible fields are `industrySlug`, `verticalSlug`, `companyModel`, `language`, `tier`, `jdExtract`, `llmModel`, `extractionMode`, and `strictIndustryMatch`.

Node never sends a Cloudinary URL directly to a multipart-only FastAPI endpoint. The CV source adapter downloads only persisted trusted Cloudinary sources, validates them, and sends the resulting bytes as multipart file. Unsupported remote storage returns an error.

## Translation flow

Node uses CVDocument.extractedText first. If it is empty, legacy cvText is accepted when supplied; otherwise Node reads the persisted PDF/DOCX through the CV source adapter, calls /v1/cv/extract, flattens sections in stable order into natural text, and sends that text to /v1/translate. The original CV is never overwritten:

```json
{
  "text": "...",
  "source_lang": "vi",
  "target_lang": "en",
  "mode": "cv_native",
  "tier": "free"
}
```

The validated response is stored in `AIResult.resultText` for frontend review.

## Portfolio adapters

The typed client includes methods for `/v1/portfolio/suggest` and `/v1/portfolio/from-image`. No new public Node Portfolio route or automatic Portfolio write was added. Future integration should use a backend-owned Cloudinary URL, require user confirmation, and persist through an existing Portfolio service.

## Error behavior

| Failure | Node response |
| --- | --- |
| CV not found/ownership mismatch | `404` before FastAPI call |
| Stored file missing | `409` |
| Unsupported/oversized file | `415`/`413` |
| FastAPI unavailable | `503` |
| Timeout | `504` |
| FastAPI validation 4xx | Safe `4xx` response |
| FastAPI quota | `429` |
| FastAPI 5xx | `502` |
| Invalid FastAPI JSON/schema | `502` |

FastAPI stack traces, raw CV payloads, API keys, and tokens are not returned or logged by the adapter. Failed AIResult records are marked `FAILED` with a safe error message.

## Tests and health checks

From `backend/`:

```powershell
npm test
npm run build
```

The AI boundary tests mock HTTP and cover URL normalization, FastAPI validation errors, timeouts, ownership-before-call, explicit mock persistence, and translation persistence. They do not call Groq or Ollama.

Manual checks:

```powershell
Invoke-WebRequest http://localhost:8001/health
Invoke-WebRequest http://localhost:5000/api/health
```

Use an applicant JWT and existing CV ID with Node Swagger at `http://localhost:5000/api/docs` to exercise the protected AI routes.

## Known limitations

- Analyze and score keep separate existing `AIResult` records and currently call the FastAPI analyze flow independently; the current schema has no safe request fingerprint for cross-action caching.
- No asynchronous job queue is added; long CV processing remains synchronous.
- FastAPI remains an independent Git repository and is intentionally not copied, staged, modified, or converted to a submodule.
- This integration does not implement chat, streaming, conversation history, quotas, or billing.

## Hardening notes

- FastAPI currently exposes these industry slugs: ai_software, business_administration, computer_science, language, law, and marketing. Node validates industrySlug against the synchronized AI_SUPPORTED_INDUSTRY_SLUGS list before reading a file or calling FastAPI. Update the env list when the independent taxonomy changes.
- The canonical default is language because it is present in the FastAPI /v1/industries response. Invalid client slugs return HTTP 400; Node does not request /v1/industries on every AI request.
- CV file sources support the current local /uploads/cvs/<filename> path, trusted Cloudinary delivery URLs under the configured cloud, and Cloudinary raw public IDs. Remote downloads require HTTPS, the configured Cloudinary account, no redirects, a timeout, a size limit, a PDF/DOCX extension, a compatible content type, and a matching file signature.
- Action/detail AI responses retain resultText for backward compatibility and add result with the parsed JSON object. Legacy non-JSON resultText is returned as a string in result.
- E2E command: start MongoDB and FastAPI mock, set AI_SERVICE_URL to the FastAPI port, then run npm run test:ai:e2e. The script uses a local cvbuddy_ai_e2e database, creates an isolated applicant/profile/CV fixture, verifies AIResult persistence, and cleans up.
## E2E validation

From the outer project:

    docker compose -f docker-compose.dev.yml up -d mongo

Run the independent FastAPI mock in another terminal and expose it on port 8001. Then run:

    cd "D:\KI 7\cvbuddy\backend"
    $env:AI_SERVICE_URL="http://localhost:8001"
    npm run test:ai:e2e

The script connects to mongodb://127.0.0.1:27017/cvbuddy_ai_e2e by default, creates an isolated applicant account/profile/CV fixture, calls the Node AI service boundary, verifies the persisted AIResult, and removes all fixtures. It refuses non-local MongoDB URIs unless AI_E2E_ALLOW_REMOTE=true is explicitly set.