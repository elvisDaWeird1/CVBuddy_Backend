# CVBuddy Backend Agent Guide

This repository is the CVBuddy backend API. It is a Node.js, TypeScript, Express, MongoDB, Mongoose, JWT, multer, and Swagger backend for the MVP.

## Read Before Coding

Before making code changes, read only the relevant parts of:

1. `AGENTS.md`
2. `README.md`
3. `BACKEND_MVP_PLAN.md`
4. `package.json`
5. `tsconfig.json`
6. `.trellis/spec/*.md`
7. `docs/api-contract.md` when API endpoints, request/response contracts, status codes, or Swagger behavior are involved
8. `docs/database.md` when models, collections, fields, indexes, enums, or relationships are involved
9. Existing files in the module being changed under `src/modules`, plus shared middleware, utils, constants, and Swagger docs as needed

If `PROJECT_CONTEXT.md`, `MVP_Database.txt`, `CVBuddy_RDS.docx`, or `Full_Database.txt` are added later, read them before work that touches scope or schema.

## Source Of Truth

- `docs/api-contract.md` is the source of truth for intended public API behavior and response contracts.
- `docs/database.md` is the human-readable database reference.
- Mongoose model/schema files are the database implementation source.
- `src/docs/swagger.paths.ts` is the implementation source for generated Swagger documentation.
- `.trellis/spec/*.md` contains durable summaries, project rules, and task orientation. Do not duplicate detailed reference tables there.

## Local Patterns

Follow the existing Express/TypeScript/Mongoose module pattern: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.validation.ts`, and `*.model.ts`. Reuse existing controllers, services, repositories, schemas, middleware, utils, constants, and helpers before adding new architecture.

Keep API responses consistent with `successResponse` and `ApiError`/error middleware. Keep authentication and authorization consistent with `authMiddleware`, `roleMiddleware`, and `src/utils/jwt.ts`.

Do not change database schema, JWT behavior, route contracts, response formats, enum values, file upload behavior, or environment variable names unless the user explicitly requests it.

Keep changes small, directly tied to the task, and testable. Use Ponytail-style implementation discipline: make the smallest useful change, preserve existing contracts, validate immediately, and document any intentional behavior change.

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

Use `.trellis/tasks/` for task notes before larger changes. Keep task files short and delete nothing unless the user asks.
