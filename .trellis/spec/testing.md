# Testing And Validation Spec

`package.json` is the source of truth for available scripts. `AGENTS.md` contains the current default validation guidance.

## Guidance

Run the narrowest relevant validation after edits. Documentation-only changes usually do not require a build. For TypeScript changes, inspect `package.json` first and choose the smallest script that validates the touched area. For route behavior changes, use Swagger or curl only when required services are available.
