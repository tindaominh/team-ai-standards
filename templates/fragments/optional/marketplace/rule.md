# Marketplace integration

For channel adapters, stock sync and orders.

- **Idempotency.** Each inbound event takes effect at most once: dedupe key (channel + external ID + event type/version) with a unique index; handlers safe to run twice.
- **Ordering.** Compare the external `updated_at` or version; ignore stale updates.
- **Retries.** Only transient failures (timeouts, connection errors, 429, 5xx), with backoff, jitter and capped attempts. Never retry 4xx validation errors. Respect `Retry-After`.
- **Rate limits.** Per-channel limits in config; throttle per shop in a shared store, not process memory.
- **Failures.** After the last retry, dead-letter with the reason. Never drop silently.
- **Reconciliation.** A periodic job compares our state with the channel and reports drift.
- **Mapping.** Explicit, tested tables; unknown values raise a mapped error.
- **Contracts.** Schema-validate responses; store the channel API version.
- Log channel, shop, external ID and correlation ID; never customer details.
