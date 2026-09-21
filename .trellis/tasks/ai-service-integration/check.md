# Check

## Validation

- Command:
- Result:

## Validation Results

- npm run build — passed (tsc).
- npm test — passed, 16/16 tests.
- docker compose -f docker-compose.dev.yml config — passed; backend receives AI_SERVICE_URL=http://host.docker.internal:8001 by default in dev compose.
- FastAPI audit image build — passed; /health and /v1/models returned HTTP 200 with MOCK_LLM=true.
- Nested repository check — git -C cvbuddy status --short was empty; no nested repository files were edited or staged.
- Outer repository check — cvbuddy/ remains untracked and unstaged; no git add, commit, or push was performed.

## Manual Checks

- Run FastAPI independently with `MOCK_LLM=true` and verify Node `/api/ai/...` routes with an applicant JWT and local CV.
- Verify FastAPI health failure maps to a backend service error and does not create a successful mock result.

## Remaining Risks

- The backend Docker Compose currently references a backend Dockerfile that is not present in this checkout; this task documents separate FastAPI and host networking rather than copying the AI repository into the outer repo.
- Real Groq/Ollama calls require provider configuration in the independent AI repository.
- Existing AIResult has no raw payload/request fingerprint fields, so results store the selected response JSON without cross-action caching.
