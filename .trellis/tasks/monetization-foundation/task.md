# Monetization foundation

## Goal

Make AI tier server-owned and add a versioned FREE/PRO entitlement and disabled PayOS billing foundation without activating billing.

## Scope

In: AI-COM-001, draft plan catalog, ENT-001/002/003 model/service/tests/docs, and disabled billing checkout/webhook foundations.

Out: FastAPI changes, real payment provider calls, PayOS dashboard configuration, production index apply, deployment, frontend checkout UI, Google login, AI UI redesign, feedback, camera.

## Files touched

- `src/config/planCatalog.ts`
- `src/modules/ai/*`
- `src/modules/entitlements/*`
- `src/modules/usage/*`
- `src/modules/billing/*`
- `tests/ai-service.integration.test.js`
- `tests/entitlement.test.js`
- API/database/env documentation

## Notes

- Public AI requests reject tier, plan, credits, and credit-cost fields.
- AI execution reserves and settles/refunds server-owned credits by idempotency key.
- Billing defaults to disabled. Checkout accepts only a server-known plan and webhook processing verifies provider data before issuing a paid entitlement.
- Catalog values remain draft and must not be treated as commercial approval.
- New indexes are source-only; no database write or migration was run.
- Credit reserve/refund uses MongoDB transactions and therefore requires a replica set in deployed environments.

## Validation

- Command: `npm test` and `npm run build`
- Result: backend `npm test` (119/119) and `npm run build` pass. Frontend `npm test` (36/36), `npm run lint`, and `npm run build` pass.

## Follow-up

- Product owner approval for price, credit allowances, and failed-request refund policy.
- Approved deployment must apply source-only indexes with backup/restore evidence, use a MongoDB replica set, configure PayOS secrets and verified HTTPS webhook, and run a real low-value payment reconciliation test.

