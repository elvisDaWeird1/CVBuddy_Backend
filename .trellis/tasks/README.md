# Trellis Tasks

Use `.trellis/tasks/` for short working notes on non-trivial backend tasks. Do not store secrets, large logs, generated build output, or permanent API/database reference data here.

## Default Shape

For normal backend work, use a single file:

```txt
.trellis/tasks/<task-slug>/task.md
```

Start from `_template/task.md` and keep it short. The default sections are goal, scope, files touched, notes, validation, and follow-up.

## Optional Larger Feature Shape

For larger feature or phase work, the existing multi-file shape is still available:

```txt
.trellis/tasks/<task-slug>/
  task.md
  plan.md
  notes.md
  check.md
```

Use this only when separate planning, notes, and validation files would make the work easier to follow.
