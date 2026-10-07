# Marketplace integration

Applies to channel adapters, stock sync, order import and order conversion.

- **Idempotency.** Every inbound event (webhook, polled order, stock update) is processed at most once in effect. Store a dedupe key (channel + external ID + event type/version) with a unique index, and make handlers safe to run twice.
- **Ordering.** Do not assume events arrive in order. Compare the external `updated_at` or version and ignore stale updates.
- **Retries.** Retry only transient failures (timeouts, connection errors, 429, 5xx) with exponential backoff and jitter, and a maximum attempt count. Do not retry 4xx validation errors. Respect `Retry-After`.
- **Rate limits.** Each channel's limits live in config. Throttle per shop/account using a shared store, not process memory, because several ECS tasks run at once.
- **Failures.** After the last retry, send the item to a dead-letter queue or failure table with the reason. Never drop it silently.
- **Reconciliation.** Each sync has a periodic job that compares our state with the channel (stock, order status) and reports or fixes differences.
- **Mapping.** Status, SKU and field mapping are explicit tables or functions with tests. Unknown values raise a mapped error; they are not defaulted.
- **Contracts.** Validate every marketplace response with a schema. Store the channel API version used.
- Log channel, shop, external ID and correlation ID. Never log customer details.
