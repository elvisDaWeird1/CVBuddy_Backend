# CVBuddy Backend Agent Guide

This repository is the CVBuddy backend API. It is a Node.js, TypeScript, Express, MongoDB, Mongoose, JWT, multer, and Swagger backend for the MVP.

## Read Before Coding

Use this file as the lightweight Codex entry point. Do not read every document for every small task.

Always inspect `package.json` before choosing validation commands. Read the current module files being changed, plus only the shared middleware, utils, constants, and docs needed for the task.

Conditional read order:

- Small backend task or bug fix: `AGENTS.md`, `package.json`, and the directly touched module/shared files.
- API route/controller, Swagger, status code, response contract, or frontend/backend integration task: also read `docs/api-contract.md` and the relevant route/controller/service/validation files.
- Database model, schema, enum, collection, index, or relationship task: also read `docs/database.md`, the relevant model files, and `src/constants/enums.ts` when enums are involved.
- Auth or security task: also read the relevant auth middleware, role middleware, JWT utility, auth service, account model, and `.trellis/spec/auth.md` if extra context is useful.
- Large feature, phase planning, or scope question: read the relevant sections of `BACKEND_MVP_PLAN.md` and optional `.trellis/spec/*.md` files for orientation.
- README is for humans running the backend and is not mandatory context for routine Codex tasks.

If `PROJECT_CONTEXT.md`, `MVP_Database.txt`, `CVBuddy_RDS.docx`, or `Full_Database.txt` are added later, read them only when the task touches product scope or schema decisions.

## Source Of Truth

- `docs/api-contract.md` is the source of truth for intended public API behavior and response contracts.
- `docs/database.md` is the human-readable database reference.
- Mongoose model/schema files are the database implementation source.
- `src/docs/swagger.paths.ts` is the implementation source for generated Swagger documentation.
- `.trellis/spec/*.md` contains optional durable summaries and task orientation. Do not duplicate detailed reference tables there.

## Local Patterns

Follow the existing Express/TypeScript/Mongoose module pattern: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.validation.ts`, and `*.model.ts`. Reuse existing controllers, services, and repositories if they already exist, plus schemas, middleware, utils, constants, and helpers before adding new architecture.

Keep API responses consistent with `successResponse` and `ApiError`/error middleware. Keep authentication and authorization consistent with `authMiddleware`, `roleMiddleware`, and `src/utils/jwt.ts`.

Do not change database schema, JWT behavior, route contracts, response formats, enum values, file upload behavior, or environment variable names unless the user explicitly requests it.

Keep changes small, directly tied to the task, and testable.

## Ponytail Backend Rules

- Make the smallest useful change that solves the task.
- Prefer existing module patterns over new architecture.
- Routes wire middleware and validation; controllers handle HTTP; services hold business logic and Mongoose calls.
- Use `asyncHandler`, `successResponse`, and `ApiError` consistently.
- Do not change API paths, response shapes, schema fields, enum values, JWT behavior, upload behavior, or environment variable names unless explicitly asked.
- Read API docs only for API behavior changes. Read database docs only for schema/model changes.
- Update Swagger/docs only when public behavior, schema, setup, or contract changes.
- Validate with the narrowest relevant script from `package.json`; currently this is usually `npm run build`.
- Do not add production-scale infrastructure unless it directly supports the MVP.

## Scripts

Inspect `package.json` before choosing validation commands. Detected scripts are currently:

- `npm run dev` - run `ts-node-dev --respawn --transpile-only src/server.ts`
- `npm run build` - run `tsc`
- `npm start` - run `node dist/server.js`

There is no test script currently. After edits, run the narrowest relevant validation command. Prefer `npm run build` for TypeScript-only changes. Use server/API checks only when needed and when MongoDB and `.env` are available.

## Repo-Local Skills

Repo-local skills live under `.agents/skills/`. They may not auto-load in every Codex surface, so future prompts should explicitly mention the skill name or path when a specific workflow should be used.

Examples:

- Use `.agents/skills/api-debugging` for API/runtime errors.
- Use `.agents/skills/backend-cvb-patterns` for backend implementation.
- Use `.agents/skills/swagger-testing` for Swagger/OpenAPI testing.
- Use `.agents/skills/phase-implementation` for planned phase work.

Use `.trellis/tasks/` for short notes on non-trivial backend work. The one-file `task.md` template is the default for normal tasks; the multi-file template shape is optional for larger feature work. Keep task files short and delete nothing unless the user asks.
