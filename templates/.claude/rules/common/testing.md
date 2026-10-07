# Testing

- Every behaviour change ships with a test that fails without the change.
- Unit tests for domain logic (mapping, pricing, stock rules). Integration tests for repositories, migrations and adapters, run against a local MySQL container.
- Mock external marketplaces and AWS at the HTTP/SDK boundary. Never call real marketplace or AWS endpoints from tests.
- Test names describe behaviour: `converts a partially paid order to PENDING_PAYMENT`.
- Cover the failure paths: timeouts, 429, 5xx, duplicate events, out-of-order events, invalid payloads.
- If a test fails, fix the code. Change the test only when the test itself is wrong, and say why.
- Coverage thresholds are enforced by CI. Do not lower them.
