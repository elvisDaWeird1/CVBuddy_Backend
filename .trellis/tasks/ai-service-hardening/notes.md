# Notes

## Audit

- CVDocument.fileUrl is written by the current CV upload flow as a local /uploads/cvs/<filename> path.
- Cloudinary is currently used by PortfolioAsset, not CVDocument, but CVDocument.fileUrl is an unconstrained string and may contain legacy remote values.
- FastAPI /v1/industries currently returns ai_software, business_administration, computer_science, language, law, and marketing.
- Translation previously required CVDocument.extractedText or legacy cvText and did not extract a file.
- AIResult.resultText stores JSON strings for the new provider responses; action/detail responses previously exposed only the string.

## Decisions

- Trusted remote source means HTTPS res.cloudinary.com with the configured Cloudinary cloud path, or a persisted Cloudinary raw public ID resolved through the Cloudinary SDK. Client-supplied URLs never enter this adapter.
- Remote download uses no redirects, timeout, response-size limit, PDF/DOCX extension, content-type check, and file signature validation.
- Node uses a synchronized AI_SUPPORTED_INDUSTRY_SLUGS allowlist and returns 400 before file/AI calls for invalid slugs.
- Translation priority is extractedText, legacy cvText, then persisted file extraction flattened in stable section order.
- Add result as parsed structured output while retaining resultText for compatibility.
- E2E uses a local cvbuddy_ai_e2e MongoDB database and an isolated generated PDF fixture.
- Final validation completed: 27/27 tests, TypeScript build, Compose config, FastAPI health/industries, and real MongoDB E2E all passed.
