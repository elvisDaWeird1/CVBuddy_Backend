# Backend Spec

CVBuddy backend is an MVP API built with Node.js, TypeScript, Express, MongoDB, Mongoose, JWT, bcrypt, multer, dotenv, and Swagger.

## Structure

- `src/server.ts` loads environment variables, connects MongoDB, and starts Express.
- `src/app.ts` configures CORS, JSON parsing, static uploads, Swagger, routes, and error handling.
- `src/modules/*` contains domain modules with routes, controllers, services, validation, and models.
- `src/middlewares` contains auth, role, validation, upload, and error middleware.
- `src/utils` contains shared API response, error, JWT, file, and async utilities.
- `src/constants/enums.ts` contains enum constants and value arrays.

## Scripts And Validation

`package.json` is the source of truth for available scripts. Use `AGENTS.md` for current validation guidance.

## Rules

Do not add product features from outside MVP scope unless explicitly requested. Keep changes small and consistent with existing TypeScript style, which currently uses `strict: false` and CommonJS output.
