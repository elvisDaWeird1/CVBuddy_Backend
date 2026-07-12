# Task

## Goal

Harden the Node backend integration with the independent FastAPI cvbuddy-ai service before frontend/mobile use.

## Scope

- Audit CVDocument/local storage and existing Cloudinary implementation.
- Add a safe local/Cloudinary CV source adapter.
- Validate FastAPI industry slugs from the synchronized taxonomy.
- Make translation source selection deterministic and file-capable.
- Add a stable parsed AI result response field while retaining resultText.
- Add adapter tests and a real local Node-to-FastAPI-mock-to-MongoDB E2E script.
- Preserve the independent nested repository and public Node route paths.

## Out of scope

- Changes inside cvbuddy/cvbuddy-ai.
- Moving repositories, submodules, frontend refactors, Groq/Ollama credentials, or production deployment.