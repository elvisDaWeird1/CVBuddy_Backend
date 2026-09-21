# Task

## Goal

Integrate the existing Node.js AI routes with the independent FastAPI `cvbuddy-ai` service over HTTP without changing the public Node API or modifying/staging the nested AI repository.

## Scope

- In scope: typed FastAPI adapter, configurable URL/timeout/enabled flag, local CV multipart extraction/analyze flow, translation flow, error mapping, existing `AIResult` persistence, optional Portfolio suggestion client methods, tests, Docker/local handoff documentation.
- Out of scope: moving the AI repository, changing `cvbuddy/.git`, adding it as a submodule, direct frontend/mobile calls to FastAPI, public route renames, schema migrations, chat/streaming, quota billing, and automatic Portfolio writes.

## Constraints

- Preserve `/api/ai/cvs/:cvId/feedback`, `/score`, `/translate-to-english`, and result routes.
- Authenticate and verify CV ownership before any AI service call.
- Never log full CV text, API keys, tokens, or raw FastAPI internals.
- Mock behavior is allowed only when `AI_SERVICE_ENABLED=false`; FastAPI failures must not silently produce mock production results.
- Do not modify files under `D:\KI 7\cvbuddy\cvbuddy`.
