# FastAPI AI Service Integration

## Architecture

The independent FastAPI repository remains outside the main repository:

```text
Frontend / Mobile -> Node backend (/api/ai/*) -> FastAPI cvbuddy-ai (/v1/*) -> Groq
```

The Node backend owns user authentication, applicant/CV ownership, public response formatting, AIResult persistence, and safe error mapping. FastAPI separately requires service-to-service authentication. Frontend and mobile must not call FastAPI directly or receive either AI secret.

## Source of truth

- Repository: `D:\KI 7\cvbuddy\cvbuddy`
- Service: `D:\KI 7\cvbuddy\cvbuddy\cvbuddy-ai`
- Contract: `cvbuddy-ai/docs/AI_CONTRACT.md` and its FastAPI schemas/routes
- Primary FastAPI prefix used by Node: `/v1`

`/v1` is the only AI API prefix. The legacy duplicate `/ai` mount is removed.

## Environment

```env
AI_SERVICE_URL=http://localhost:8001
AI_SERVICE_TIMEOUT_MS=60000
AI_SERVICE_ENABLED=true
AI_INTERNAL_API_KEY=
AI_SERVICE_ALLOW_MOCK_OUTPUT=false
AI_DEFAULT_INDUSTRY_SLUG=language
AI_DEFAULT_VERTICAL_SLUG=
AI_DEFAULT_COMPANY_MODEL=corporate
AI_DEFAULT_LANGUAGE=both
AI_SUPPORTED_INDUSTRY_SLUGS=ai_software,business_administration,computer_science,language,law,marketing
```

- `AI_SERVICE_ENABLED=true` explicitly enables execution and calls FastAPI; missing/false fails closed.
- `AI_SERVICE_ENABLED=false` returns `503 AI_FEATURE_DISABLED`. It never creates a mock result or calls FastAPI.
- `AI_SERVICE_ALLOW_MOCK_OUTPUT=true` is an explicit local/test-only opt-in for a FastAPI mock provider. Production startup rejects this setting, and mock-marked responses are otherwise rejected before persistence.
- FastAPI failure never silently falls back to a successful mock result.
- `AI_SERVICE_URL` is the service root, is normalized without a trailing slash, and must not contain `/v1`, a query, or a fragment.
- `AI_INTERNAL_API_KEY` is shared only through the Node and FastAPI platform secret stores. Production requires at least 32 characters.
- `AI_SERVICE_TIMEOUT_MS` controls the AbortController timeout and production accepts `1000` through `120000` milliseconds.
- `AI_DEFAULT_INDUSTRY_SLUG` preserves compatibility with old clients that only send `targetRole`/`cvText`; new clients should send `industrySlug` when known.
- Groq/Ollama credentials remain only in the FastAPI repository `.env`.
- Node sends `X-AI-Internal-Key` and the incoming `X-Request-ID` on every FastAPI call. Redirects are rejected so the internal key is never forwarded to another host.
- Production accepts a successful final AI result only when metadata contains both `source=groq` and `provider=groq`.

## Local startup

### FastAPI with mock provider

```powershell
cd "D:\KI 7\cvbuddy\cvbuddy\cvbuddy-ai"
Copy-Item .env.example .env
```

Set `LLM_PROVIDER=mock`, `MOCK_LLM=true`, and a local-only `AI_INTERNAL_API_KEY` in the copied `.env`, then run:

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
For this local mock exercise only, also set `AI_SERVICE_ENABLED=true`, the same `AI_INTERNAL_API_KEY`, and `AI_SERVICE_ALLOW_MOCK_OUTPUT=true`.

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
| `POST /api/ai/cvs/:cvId/feedback` | `/v1/cv/extract-and-analyze` by default; two-step `/extract` + `/analyze` when JD context is needed | `CV_FEEDBACK` |
| `POST /api/ai/cvs/:cvId/score` | `/v1/cv/extract-and-analyze` by default; two-step `/extract` + `/analyze` when JD context is needed | `CV_SCORING, score=overall_score` |
| `POST /api/ai/cvs/:cvId/translate-to-english` | `/v1/translate` | `CV_TRANSLATION` |
| `GET /api/ai/results` | MongoDB only | Existing response |
| `GET /api/ai/results/:id` | MongoDB only | Existing response |

The Node public route names and response wrapper are unchanged.

## Analyze flow

The current CV storage uses local `/uploads/cvs/<filename>` paths. For analysis, Node:

1. Authenticates the applicant and verifies the CV belongs to that account.
2. Resolves the persisted local or trusted Cloudinary PDF/DOCX through the source adapter and enforces the configured size limit.
3. When there is no JD context, sends the file as multipart field `file` to `POST /v1/cv/extract-and-analyze` with the supported query parameters.
4. When `targetRole` or `jdExtract` must be preserved, sends the file to `POST /v1/cv/extract`, then sends the returned `sections` and `local_metrics` to `POST /v1/cv/analyze`.
5. Stores the validated FastAPI response as JSON in `AIResult.resultText`.

The legacy `targetRole` field maps to FastAPI `jd_extract.role_title`. Optional compatible fields are `industrySlug`, `verticalSlug`, `companyModel`, `language`, `jdExtract`, `llmModel`, `extractionMode`, and `strictIndustryMatch`. The public API rejects client-supplied tier, plan, credits, and credit cost. Until the entitlement service is connected, Node always sends the server-owned `free` tier to FastAPI.

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
| AI capability disabled | `503 AI_FEATURE_DISABLED` |
| CV not found/ownership mismatch | `404` before FastAPI call |
| Stored file missing | `409` |
| Unsupported/oversized file | `415`/`413` |
| FastAPI unavailable/connection failure | `503 AI_SERVICE_UNAVAILABLE` |
| FastAPI internal authentication mismatch | `503 AI_SERVICE_AUTH_FAILED` |
| Timeout | `504 AI_SERVICE_TIMEOUT` |
| FastAPI-reported provider timeout | `504 AI_PROVIDER_TIMEOUT` |
| FastAPI validation 4xx | Safe `4xx` response |
| FastAPI quota | `429` |
| FastAPI 5xx | `502 AI_PROVIDER_ERROR` |
| Non-JSON/empty success response, invalid FastAPI schema, missing Groq provenance, or disallowed mock output | `502 AI_PROVIDER_ERROR` |
| Non-JSON/empty FastAPI error response | Preserve the upstream HTTP failure class and map it to the existing safe Node error code |

FastAPI stack traces, raw response bodies, CV payloads, API keys, and tokens are not returned or logged by the adapter. Logs classify an upstream body only as `json`, `non_json`, or `empty`, together with the safe HTTP status and request ID. Extraction responses must contain all section arrays, the complete local-metrics object, a positive normalized text length, and at least one non-empty extracted block before Node can call the analyze step. Failed AIResult records are marked `FAILED` with a safe error message.

## Tests and health checks

From `backend/`:

```powershell
npm test
npm run build
```

The AI boundary tests mock HTTP and cover URL normalization, FastAPI validation errors, non-JSON/empty upstream classification, strict extraction validation, fail-closed capability gating, connection failures, timeouts, 5xx responses, explicit local mock opt-in/rejection, and successful persistence. They do not call Groq or Ollama.

Manual liveness/readiness checks:

```powershell
Invoke-WebRequest http://localhost:8001/health
Invoke-WebRequest http://localhost:8001/ready
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

Run the independent FastAPI mock in another terminal, expose it on port 8001,
and configure the same local-only `AI_INTERNAL_API_KEY` in both processes. Then run:

    cd "D:\KI 7\cvbuddy\backend"
    $env:AI_SERVICE_URL="http://localhost:8001"
    $env:AI_INTERNAL_API_KEY="<same local test value configured in FastAPI>"
    npm run test:ai:e2e

The script explicitly enables local/test mock output, connects to mongodb://127.0.0.1:27017/cvbuddy_ai_e2e by default, creates an isolated applicant account/profile/CV fixture, calls the Node AI service boundary, verifies the persisted AIResult, and removes all fixtures. It refuses non-local MongoDB URIs unless AI_E2E_ALLOW_REMOTE=true is explicitly set.
