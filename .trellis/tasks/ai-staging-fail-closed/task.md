# Task

## Goal

Make backend AI execution fail closed for staging: disabled AI and upstream failures must never persist mock output as a successful result.

## Scope

- Capability gate and stable upstream error codes.
- FAILED persistence and completion timestamps for started AIResult records.
- Explicit non-production mock-output opt-in.
- Clear readiness semantics and regression tests.

## Out of scope

- Enabling staging AI, adding provider secrets, deploying, changing MongoDB data, or editing the independent Python AI service.
