# DEP-014 — Backend CI release gate

Uses `npm ci`, the isolated HTTP/Mongo test suite, TypeScript build, and a production
Docker image build. AI is disabled and no production dependency credentials are used.
