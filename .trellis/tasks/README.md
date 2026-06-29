# Trellis Tasks

Use `.trellis/tasks/` for short working notes on non-trivial backend tasks. Do not store secrets, large logs, generated build output, or permanent API/database reference data here.

## Shape

Create one folder per task:

```txt
.trellis/tasks/<task-slug>/
  task.md
  plan.md
  notes.md
  check.md
```

Recommended files:

- `task.md` - goal, scope, constraints.
- `plan.md` - small checklist of intended steps.
- `notes.md` - discoveries and decisions while working.
- `check.md` - validation commands, results, and remaining risks.

Start from `_template/` when useful and keep notes short.
