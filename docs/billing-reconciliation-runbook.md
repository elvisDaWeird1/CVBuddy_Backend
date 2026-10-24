# Billing reconciliation runbook

Billing reconciliation remains disabled by default. Do not enable it until controlled index
rollout, Controlled Live PayOS provider verification, and transaction-topology readiness pass.

## Worker contract

The optional worker runs only when both `BILLING_ENABLED=true` and
`BILLING_RECONCILIATION_ENABLED=true`. It claims due orders with a two-minute lease,
queries PayOS through the adapter outside a MongoDB transaction, then finalizes a
verified payment in a separate transaction. A crashed worker's lease expires and can
be reclaimed by another instance.

The default backoff is 1 minute, 5 minutes, 15 minutes, then 60 minutes. Automatic
retries stop after 24 hours; the order is retained with
`RECONCILIATION_EXHAUSTED` for manual review. A provider outage never changes an order
to `FAILED`.

At startup the worker emits the safe `billing_reconciliation_worker_started` event.
Each completed cycle emits `billing_reconciliation_cycle_completed` with only the
candidate and reconciliation counts. These events are the operational evidence for a
zero-candidate smoke cycle; they contain no order identifiers, provider payloads, or
credentials.

## One-shot provider verification

Before enabling the worker, an operator may run a single read-only check against one
already-paid internal order:

```powershell
npm run verify:payos-payment -- --database test --order-id "<internal-order-id>"
```

The command requires both arguments, refuses a database-name mismatch, reads one local
order, performs one PayOS status lookup, and prints only status classifications and
boolean match results. It never creates a checkout, claims a lease, updates an order,
grants an entitlement, or exposes provider references or credentials.

## Support workflow

For `paid but not unlocked`, inspect the internal billing order ID and entitlement
grant's `sourceOrderId`. Re-run the reconciliation domain operation through a protected
operational process after validating the provider status. Do not grant PRO manually:
`sourceOrderId` is the unique database boundary that prevents a duplicate extension.

For a long-pending order, inspect only safe fields: order status, reconciliation attempt
count, last safe error code, and next reconciliation time. Never copy webhook payloads,
signatures, credentials, banking data, or checkout URLs into support tickets.

## Staging database rollout

Before enabling reconciliation: take a backup reference, inventory indexes, check for
duplicates, then create and verify `{ status: 1, nextReconciliationAt: 1 }` in a
controlled staging change. Roll back by disabling the reconciliation flag; do not drop
an index during an incident without an approved database change.

## Webhook middleware order

The general browser/API limiter skips only `/api/billing/webhooks/payos`. The dedicated
webhook limiter remains active, then webhook signature verification runs before the
transactional finalization. A failed transaction returns a non-2xx response so PayOS
may retry; reconciliation covers missed deliveries.

## Shutdown and rollback

The server retains the worker cleanup callback and clears its interval on `SIGTERM` or
`SIGINT`. If reconciliation behaves unexpectedly, first set
`BILLING_RECONCILIATION_ENABLED=false` and redeploy. Do not alter paid orders or grants
manually; inspect safe order status, lease, retry count, and error code before escalation.
